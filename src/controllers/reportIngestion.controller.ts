import { Request, Response } from 'express';
import fs from 'fs/promises';
import { db } from '../services/db.js';
import { logger } from '../utils/logger.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { orgId } from '../utils/scope.js';
import { sha256File } from '../utils/checksum.js';
import { enqueueIngestionJob } from '../queues/ingestion.queue.js';
import { StorageService } from '../services/storage.service.js';

/**
 * Ingestion is asynchronous (Phase 3): the API validates the upload, records
 * an IngestionJob, enqueues it, and returns 202 immediately — OCR/parsing/
 * risk-analysis run in the worker process, off the request/response cycle.
 * Clients follow up via GET .../ingestion-jobs/:id or the `ingestion:completed`
 * / `ingestion:failed` realtime events.
 */
export class ReportIngestionController {
  /** Ingest a report for an EXPLICIT athlete (athleteId in the URL). */
  static async ingestReport(req: Request, res: Response) {
    const { athleteId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });

    const athlete = await db.athlete.findFirst({
      where: { id: athleteId, organizationId: orgId(req), deletedAt: null },
    });
    if (!athlete) {
      return res.status(404).json({ status: 'error', message: 'Athlete not found in database. Clinical intake aborted.' });
    }

    return ReportIngestionController.enqueue(req, res, athlete.id);
  }

  /**
   * Ingest a report WITHOUT a pre-selected athlete. The worker auto-detects
   * the athlete from the parsed document (then the file name) and matches or
   * creates a record. Powers the Reports page "just upload" flow.
   */
  static async ingestAutoMatch(req: Request, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    return ReportIngestionController.enqueue(req, res, undefined);
  }

  // ── Shared: validate, dedupe, persist job, enqueue ──────────────────────────
  private static async enqueue(req: Request, res: Response, athleteId: string | undefined) {
    const file = req.file!;
    const organizationId = orgId(req);
    const uploaderId = req.user?.id ?? (await getSystemUserId());

    try {
      // Checksum the bytes multer staged locally, before storage decides
      // whether that staging copy stays (local driver) or is uploaded to S3
      // and removed (s3 driver) — either way this is the identity of what
      // was uploaded.
      const checksum = await sha256File(file.path);

      // Idempotency: a duplicate submission (double-click, client retry) of the
      // exact same bytes within this organization reuses the existing job
      // instead of processing it twice.
      const existing = await db.ingestionJob.findFirst({
        where: { organizationId, checksum, status: { in: ['QUEUED', 'PROCESSING', 'COMPLETED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        logger.info(`↩ Duplicate upload (checksum ${checksum.slice(0, 12)}…) — reusing job ${existing.id}`);
        // The just-staged local copy was never handed off to storage for this
        // request (we're short-circuiting to the existing job) — remove it so
        // it doesn't linger as an orphaned duplicate on disk.
        await fs.unlink(file.path).catch(() => {});
        return res.status(existing.status === 'COMPLETED' ? 200 : 202).json({
          status: 'success',
          message: existing.status === 'COMPLETED' ? 'Already ingested' : 'Ingestion already in progress',
          data: ReportIngestionController.toJobResponse(existing),
        });
      }

      // Hand off to durable storage (ENGINEERING_READINESS.md blocker B1):
      // no-op passthrough on the default `local` driver, upload-then-delete
      // on the `s3` driver. `filePath` from here on is whatever reference
      // (local path or s3:// URI) the worker needs to read the bytes back.
      const filePath = await StorageService.persist(file.path, file.originalname, file.mimetype);

      const job = await db.ingestionJob.create({
        data: {
          organizationId,
          athleteId,
          uploaderId,
          fileName: file.originalname,
          filePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          status: 'QUEUED',
        },
      });

      await enqueueIngestionJob({
        ingestionJobId: job.id,
        organizationId,
        uploaderId,
        filePath,
        fileName: file.originalname,
        mimeType: file.mimetype,
        athleteId,
      });

      logger.info(`📥 Queued ingestion job ${job.id} for org ${organizationId}${athleteId ? ` (athlete ${athleteId})` : ' (auto-match)'}`);

      return res.status(202).json({
        status: 'success',
        message: 'Report queued for ingestion',
        data: ReportIngestionController.toJobResponse(job),
      });
    } catch (error: any) {
      logger.error('❌ Failed to queue ingestion job:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to queue ingestion: ' + error.message });
    }
  }

  /** Poll the status of a previously-queued ingestion job. */
  static async getIngestionJobStatus(req: Request, res: Response) {
    const { id } = req.params;
    const job = await db.ingestionJob.findFirst({
      where: { id, organizationId: orgId(req) },
    });
    if (!job) return res.status(404).json({ status: 'error', message: 'Ingestion job not found' });
    return res.json({ status: 'success', data: ReportIngestionController.toJobResponse(job) });
  }

  static async getIngestionHistory(req: Request, res: Response) {
    const { athleteId } = req.params;
    try {
      const reports = await db.medicalReport.findMany({
        where: { athleteId, athlete: { organizationId: orgId(req) } },
        orderBy: { createdAt: 'desc' },
        include: { testResults: true },
      });
      res.json({ status: 'success', data: { reports } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private static toJobResponse(job: {
    id: string;
    status: string;
    stage: string | null;
    progress: number;
    reportId: string | null;
    athleteId: string | null;
    error: string | null;
    resultSummary: string | null;
  }) {
    return {
      ingestionJobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      reportId: job.reportId,
      athleteId: job.athleteId,
      error: job.error,
      result: job.resultSummary ? JSON.parse(job.resultSummary) : null,
    };
  }
}
