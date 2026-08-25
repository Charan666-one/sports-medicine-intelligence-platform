import { db } from './db.js';
import { logger } from '../utils/logger.js';
import { DocumentParserService, ParsingResult } from './documentParser.service.js';
import { ReportValidationService } from './reportValidation.service.js';
import { AIEngineService } from './aiEngine.service.js';
import { AthleteMatchService } from './athleteMatch.service.js';
import { SocketService } from './socket.service.js';
import { AuditService } from './audit.service.js';
import { StorageService } from './storage.service.js';

/**
 * The actual ingestion pipeline — OCR/parse → athlete match → validate →
 * persist → risk analysis. Extracted from the HTTP controller (Phase 3) so it
 * can run inside a BullMQ worker, off the request/response cycle. Pure enough
 * to unit test: no `req`/`res`, all inputs passed explicitly, progress and
 * audit side effects reported through injected callbacks.
 */

export interface IngestionInput {
  organizationId: string;
  uploaderId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  /** Known up front for explicit-athlete uploads; undefined for auto-match. */
  athleteId?: string;
  /** Client IP, for the audit log entry (best-effort; may be unset from a worker). */
  ip?: string;
}

export interface IngestionOutcome {
  reportId: string;
  athlete: { id: string; name: string; matched: boolean; detectedName: string | null };
  validation: ReturnType<typeof ReportValidationService.validate>;
  biomarkers: ParsingResult['biomarkers'];
  confidence: number;
  ai: {
    riskLevel: string;
    probabilities: unknown;
    anomaly: unknown;
    explanation: string[];
    confidence: unknown;
  } | null;
}

export type ProgressReporter = (progress: number, stage: string) => Promise<void> | void;

export async function runIngestionPipeline(
  input: IngestionInput,
  onProgress: ProgressReporter = () => {},
): Promise<IngestionOutcome> {
  const { filePath, fileName, mimeType, organizationId, uploaderId } = input;

  // 1. Parse (OCR / PDF text extraction / CSV) — the expensive step this
  //    whole pipeline was moved off the HTTP request path to isolate.
  await onProgress(10, 'OCR_PARSING');
  let parseResult: ParsingResult;
  // `filePath` may be a local path (default `local` storage driver) or an
  // `s3://` reference (`s3` driver) — the OCR/PDF/CSV parsers below all read
  // via local `fs` APIs, so materialize a local copy first. This is a no-op
  // passthrough for the local driver; for s3 it downloads to a temp file
  // that's cleaned up after parsing regardless of success/failure.
  const { path: localPath, cleanup } = await StorageService.materializeLocal(filePath);
  try {
    parseResult = await DocumentParserService.parseDocument(localPath, mimeType);
  } catch (parseErr: any) {
    throw new Error(`OCR/parsing failed: ${parseErr.message}`);
  } finally {
    await cleanup();
  }

  // 2. Resolve the athlete — explicit for /athletes/:id/ingest, auto-matched
  //    (from the parsed text, then the file name) for /reports/ingest.
  let athleteId = input.athleteId;
  let athleteName: string;
  let matched = true;
  let detectedName: string | null = null;

  if (athleteId) {
    const athlete = await db.athlete.findFirst({ where: { id: athleteId, organizationId, deletedAt: null } });
    if (!athlete) throw new Error('Athlete not found in the caller\'s organization.');
    athleteName = athlete.name;
    detectedName = athlete.name;
  } else {
    const match = await AthleteMatchService.resolve({
      fileName,
      rawText: parseResult.rawText,
      organizationId,
    });
    athleteId = match.athleteId;
    athleteName = match.athleteName;
    matched = match.matched;
    detectedName = match.detectedName;
  }

  await onProgress(35, 'ATHLETE_RESOLVED');
  SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'COMPLETED', { confidence: parseResult.confidence });

  // 3. Validate extracted biomarkers against physiological ranges.
  SocketService.emitPipeline(athleteId, 'VALIDATION', 'PROCESSING');
  const validation = ReportValidationService.validate(parseResult.biomarkers, parseResult.confidence);
  SocketService.emitPipeline(athleteId, 'VALIDATION', 'COMPLETED', { valid: validation.isValid });
  await onProgress(50, 'VALIDATION');

  // 4. Persist the report + extracted biomarkers.
  const report = await db.medicalReport.create({
    data: {
      athleteId,
      creatorId: uploaderId,
      type: 'BLOOD',
      status: validation.isValid ? 'COMPLETED' : 'FLAGGED',
      fileName,
      fileUrl: filePath,
      fileType: mimeType,
      ocrRawText: parseResult.rawText,
      extractedJSON: JSON.stringify(parseResult.biomarkers),
      ocrConfidence: parseResult.confidence,
      parsingConfidence: validation.qualityScore,
      validationStatus: validation.status,
      validationNotes: validation.notes.join('\n'),
      dataQualityFindings: JSON.stringify(validation.findings),
      extractionQuality:
        validation.qualityScore > 0.8 ? 'EXCELLENT' : validation.qualityScore > 0.5 ? 'GOOD' : 'POOR',
    },
  });
  SocketService.emitPipeline(athleteId, 'DATA_PERSISTENCE', 'COMPLETED', { reportId: report.id });
  await onProgress(65, 'DATA_PERSISTENCE');

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

  // 5. Risk & anomaly analysis. Uses processAthleteAIUpdate (not
  //    analyzeAthleteAI directly) so a CRITICAL/anomalous finding from an
  //    upload raises an Alert, matching the manual-recalculation path.
  let aiResult = null;
  if (parseResult.biomarkers.length > 0) {
    SocketService.emitPipeline(athleteId, 'AI_SCAN', 'QUEUED');
    await onProgress(80, 'AI_SCAN');
    try {
      const dataErrorParameters = validation.findings
        .filter((f) => f.category === 'DATA_ERROR')
        .map((f) => f.parameter);
      aiResult = await AIEngineService.processAthleteAIUpdate(athleteId, dataErrorParameters);
      SocketService.emitPipeline(athleteId, 'AI_SCAN', 'COMPLETED');
    } catch (aiErr: any) {
      logger.warn('AI Engine analysis skipped: ' + aiErr.message);
      SocketService.emitPipeline(athleteId, 'AI_SCAN', 'FAILED', { error: aiErr.message });
    }
  }

  SocketService.emitPipeline(athleteId, 'INGESTION', 'COMPLETED');
  await onProgress(100, 'COMPLETED');

  await AuditService.log({
    userId: uploaderId,
    action: 'REPORT_INGEST',
    details: `Ingested "${fileName}" for ${athleteName} (${parseResult.biomarkers.length} biomarkers)`,
  });

  return {
    reportId: report.id,
    athlete: { id: athleteId, name: athleteName, matched, detectedName },
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
  };
}
