import { Worker, Job } from 'bullmq';
import { createRedisConnection } from './connection.js';
import { INGESTION_QUEUE_NAME, IngestionJobPayload, isFinalAttempt } from './ingestion.queue.js';
import { db } from '../services/db.js';
import { runIngestionPipeline } from '../services/ingestionPipeline.service.js';
import { SocketService } from '../services/socket.service.js';
import { logger } from '../utils/logger.js';

/** How many ingestion jobs this worker processes concurrently. */
const CONCURRENCY = Number(process.env.INGESTION_WORKER_CONCURRENCY ?? 2);

export function createIngestionWorker(): Worker<IngestionJobPayload> {
  const worker = new Worker<IngestionJobPayload>(
    INGESTION_QUEUE_NAME,
    async (job: Job<IngestionJobPayload>) => {
      const { ingestionJobId } = job.data;
      logger.info(`▶ Processing ingestion job ${ingestionJobId} (attempt ${job.attemptsMade + 1})`);

      await db.ingestionJob.update({
        where: { id: ingestionJobId },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, stage: 'STARTED' },
      });

      try {
        const outcome = await runIngestionPipeline(job.data, async (progress, stage) => {
          await job.updateProgress(progress);
          await db.ingestionJob.update({ where: { id: ingestionJobId }, data: { progress, stage } }).catch(() => {
            /* best-effort progress write; never fail the job over a progress update */
          });
        });

        await db.ingestionJob.update({
          where: { id: ingestionJobId },
          data: {
            status: 'COMPLETED',
            stage: 'COMPLETED',
            progress: 100,
            reportId: outcome.reportId,
            resultSummary: JSON.stringify({
              biomarkerCount: outcome.biomarkers.length,
              riskLevel: outcome.ai?.riskLevel ?? null,
              isAnomaly: (outcome.ai?.anomaly as any)?.isAnomaly ?? null,
              validationStatus: outcome.validation.status,
              athleteId: outcome.athlete.id,
              athleteName: outcome.athlete.name,
            }),
            completedAt: new Date(),
            error: null,
          },
        });

        // Terminal event carrying the full result, for clients polling/
        // listening on this specific job (same payload shape the old
        // synchronous endpoint used to return directly).
        SocketService.emit('ingestion:completed', { ingestionJobId, ...outcome });

        logger.info(`✔ Ingestion job ${ingestionJobId} completed → report ${outcome.reportId}`);
        return outcome;
      } catch (err: any) {
        const maxAttempts = job.opts.attempts ?? 1;
        const finalAttempt = isFinalAttempt(job.attemptsMade, maxAttempts);
        logger.error(
          `✘ Ingestion job ${ingestionJobId} failed (attempt ${job.attemptsMade + 1}/${maxAttempts})`,
          err,
        );

        await db.ingestionJob.update({
          where: { id: ingestionJobId },
          data: {
            status: finalAttempt ? 'DEAD_LETTER' : 'FAILED',
            error: err.message?.slice(0, 2000) ?? 'Unknown error',
          },
        });

        if (finalAttempt) {
          SocketService.emit('ingestion:failed', { ingestionJobId, error: err.message });
        }

        // Re-throw so BullMQ records the failure and (if attempts remain)
        // schedules the exponential-backoff retry.
        throw err;
      }
    },
    { connection: createRedisConnection(), concurrency: CONCURRENCY },
  );

  worker.on('error', (err) => logger.error('Ingestion worker error', err));

  return worker;
}
