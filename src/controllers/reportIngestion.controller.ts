import { Request, Response } from 'express';
import { db } from '../services/db.js';
import { logger } from '../utils/logger.js';
import { DocumentParserService, ParsingResult } from '../services/documentParser.service.js';
import { ReportValidationService } from '../services/reportValidation.service.js';
import { AIEngineService } from '../services/aiEngine.service.js';
import { AthleteMatchService } from '../services/athleteMatch.service.js';
import { SocketService } from '../services/socket.service.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { AuditService } from '../services/audit.service.js';

export class ReportIngestionController {
  /**
   * Ingest a report for an EXPLICIT athlete (athleteId in the URL).
   */
  static async ingestReport(req: Request, res: Response) {
    const { athleteId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });

    const athlete = await db.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      return res.status(404).json({ status: 'error', message: 'Athlete not found in database. Clinical intake aborted.' });
    }
    return ReportIngestionController.runPipeline(req, res, {
      athleteId: athlete.id,
      athleteName: athlete.name,
      matched: true,
      detectedName: athlete.name,
    });
  }

  /**
   * Ingest a report WITHOUT a pre-selected athlete. The athlete is auto-detected
   * from the uploaded file (parsed text first, then file name) and matched to an
   * existing record or created. Powers the Reports page "just upload" flow.
   */
  static async ingestAutoMatch(req: Request, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });

    try {
      // Parse once up front so we can use the text for name detection.
      const parseResult = await DocumentParserService.parseDocument(file.path, file.mimetype);
      const match = await AthleteMatchService.resolve({
        fileName: file.originalname,
        rawText: parseResult.rawText,
        // Scope matching + creation to the uploader's organization (tenant isolation).
        organizationId: req.user?.organizationId,
      });
      return ReportIngestionController.runPipeline(req, res, match, parseResult);
    } catch (error: any) {
      logger.error('❌ Auto-match ingestion failed:', error);
      return res.status(422).json({ status: 'error', message: 'Ingestion failed: ' + error.message });
    }
  }

  // ── Shared pipeline ──────────────────────────────────────────────────────────
  private static async runPipeline(
    req: Request,
    res: Response,
    match: { athleteId: string; athleteName: string; matched: boolean; detectedName: string | null },
    preParsed?: ParsingResult,
  ) {
    const file = req.file!;
    const { athleteId, athleteName } = match;

    try {
      logger.info(`📥 Ingestion for athlete ${athleteName} (${athleteId})`);
      const creatorId = req.user?.id || (await getSystemUserId());

      // 1. Initial record
      const report = await db.medicalReport.create({
        data: {
          athleteId,
          creatorId,
          type: 'BLOOD',
          status: 'PENDING',
          fileName: file.originalname,
          fileUrl: file.path,
          fileType: file.mimetype,
          validationStatus: 'PENDING',
        },
      });
      SocketService.emitPipeline(athleteId, 'INGESTION', 'STARTED', { reportId: report.id });

      // 2. Parse (reuse pre-parsed result from auto-match to avoid double work)
      SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'PROCESSING');
      let parseResult: ParsingResult;
      try {
        parseResult = preParsed ?? (await DocumentParserService.parseDocument(file.path, file.mimetype));
      } catch (parseErr: any) {
        SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'FAILED', { error: parseErr.message });
        await db.medicalReport.update({
          where: { id: report.id },
          data: { status: 'FLAGGED', validationStatus: 'INVALID', validationNotes: parseErr.message },
        });
        return res.status(422).json({ status: 'error', message: 'Ingestion failed: ' + parseErr.message });
      }
      SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'COMPLETED', { confidence: parseResult.confidence });

      // 3. Validate
      SocketService.emitPipeline(athleteId, 'VALIDATION', 'PROCESSING');
      const validation = ReportValidationService.validate(parseResult.biomarkers);
      SocketService.emitPipeline(athleteId, 'VALIDATION', 'COMPLETED', { valid: validation.isValid });

      // 4. Persist extraction results
      await db.medicalReport.update({
        where: { id: report.id },
        data: {
          status: validation.isValid ? 'COMPLETED' : 'FLAGGED',
          ocrRawText: parseResult.rawText,
          extractedJSON: JSON.stringify(parseResult.biomarkers),
          ocrConfidence: parseResult.confidence,
          parsingConfidence: validation.qualityScore,
          validationStatus: validation.status,
          validationNotes: validation.notes.join('\n'),
          extractionQuality:
            validation.qualityScore > 0.8 ? 'EXCELLENT' : validation.qualityScore > 0.5 ? 'GOOD' : 'POOR',
        },
      });

      // 5. Test results
      if (parseResult.biomarkers.length > 0) {
        await db.testResult.createMany({
          data: parseResult.biomarkers.map((b) => ({
            reportId: report.id,
            parameter: b.parameter,
            value: b.value,
            unit: b.unit,
          })),
        });
      }

      // 6. AI intelligence pipeline (computes real risk from the extracted data)
      let aiResult = null;
      if (parseResult.biomarkers.length > 0) {
        SocketService.emitPipeline(athleteId, 'AI_SCAN', 'QUEUED');
        try {
          aiResult = await AIEngineService.analyzeAthleteAI(athleteId);
          SocketService.emitPipeline(athleteId, 'AI_SCAN', 'COMPLETED');
        } catch (aiErr: any) {
          logger.warn('AI Engine analysis skipped: ' + aiErr.message);
          SocketService.emitPipeline(athleteId, 'AI_SCAN', 'FAILED', { error: aiErr.message });
        }
      }

      SocketService.emitPipeline(athleteId, 'INGESTION', 'COMPLETED');
      await AuditService.log({
        userId: creatorId,
        action: 'REPORT_INGEST',
        details: `Ingested "${file.originalname}" for ${athleteName} (${parseResult.biomarkers.length} biomarkers)`,
        req,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Report ingested successfully',
        data: {
          reportId: report.id,
          athlete: { id: athleteId, name: athleteName, matched: match.matched, detectedName: match.detectedName },
          validation,
          biomarkers: parseResult.biomarkers,
          confidence: parseResult.confidence,
          ai: aiResult
            ? {
                riskLevel: aiResult.riskLevel,
                probabilities: aiResult.probabilities,
                anomaly: aiResult.anomaly,
                explanation: aiResult.explanation,
                confidence: aiResult.xai?.confidence,
              }
            : null,
        },
      });
    } catch (error: any) {
      logger.error('❌ Ingestion Error:', error);
      return res.status(500).json({ status: 'error', message: 'Ingestion failed: ' + error.message });
    }
  }

  static async getIngestionHistory(req: Request, res: Response) {
    const { athleteId } = req.params;
    try {
      const reports = await db.medicalReport.findMany({
        where: { athleteId },
        orderBy: { createdAt: 'desc' },
        include: { testResults: true },
      });
      res.json({ status: 'success', data: { reports } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
