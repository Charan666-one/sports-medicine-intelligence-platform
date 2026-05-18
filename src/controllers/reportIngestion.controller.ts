import { Request, Response } from 'express';
import { db } from '../services/db.js';
import { logger } from '../utils/logger.js';
import { DocumentParserService } from '../services/documentParser.service.js';
import { ReportValidationService } from '../services/reportValidation.service.js';
import { AIEngineService } from '../services/aiEngine.service.js';
import { SocketService } from '../services/socket.service.js';

export class ReportIngestionController {
  static async ingestReport(req: Request, res: Response) {
    const { athleteId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      logger.info(`📥 Starting ingestion for athlete ${athleteId}`);
      // Fetch athlete name for activity feed
      const athlete = await db.athlete.findUnique({ where: { id: athleteId } });
      
      if (!athlete) {
        logger.error(`❌ Athlete ${athleteId} not found`);
        return res.status(404).json({ 
          status: 'error', 
          message: 'Athlete not found in database. Clinical intake aborted.' 
        });
      }

      logger.info(`👤 Found athlete: ${athlete.name}`);

      // 1. Initial Database Record
      logger.info('💾 Creating initial database record...');
      
      // Try to find an admin user to associate with
      let creatorUser = await db.user.findFirst();
      
      // If no users at all, we might be in an unseeded state
      if (!creatorUser) {
        logger.warn('⚠️ No users found in database. Running emergency system user creation...');
        try {
          // Find or create an organization first
          let org = await db.organization.findFirst();
          if (!org) {
            org = await db.organization.create({
              data: { name: 'Emergency Org', slug: 'emergency-org' }
            });
          }
          
          // Find or create a role
          let role = await db.role.findFirst({ where: { organizationId: org.id } });
          if (!role) {
            role = await db.role.create({
              data: { name: 'SYSTEM_ADMIN', organizationId: org.id }
            });
          }

          creatorUser = await db.user.create({
            data: {
              email: 'system@sportsmed.ai',
              password: 'system_managed_key',
              name: 'AI System Ingestion',
              organizationId: org.id,
              roleId: role.id
            }
          });
        } catch (dbErr) {
          logger.error('❌ Failed to create emergency system user', dbErr);
          throw new Error('Database is unpopulated and emergency recovery failed.');
        }
      }

      const creatorId = (req as any).user?.id || creatorUser.id;

      const report = await db.medicalReport.create({
        data: {
          athleteId,
          creatorId,
          type: 'BLOOD',
          status: 'PENDING',
          fileName: file.originalname,
          fileUrl: file.path,
          fileType: file.mimetype,
          validationStatus: 'PENDING'
        }
      });
      logger.info(`✅ Initial record created: ${report.id}`);

      // Real-time notification: Ingestion started
      SocketService.emitPipeline(athleteId, 'INGESTION', 'STARTED', { reportId: report.id });
      SocketService.emitActivity({
        type: 'INGESTION_START',
        message: `New report upload detected for ${athlete.name}`,
        severity: 'INFO',
        data: { athleteId, reportId: report.id }
      });

      // 2. Parse Document (OCR + Extraction)
      logger.info(`📄 Parsing document: ${file.path}`);
      SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'PROCESSING');
      
      let parseResult;
      try {
        parseResult = await DocumentParserService.parseDocument(file.path, file.mimetype);
      } catch (parseErr: any) {
        logger.error('❌ OCR/Parsing stage failed', parseErr);
        SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'FAILED', { error: parseErr.message });
        throw parseErr;
      }
      
      logger.info(`✅ Parsing complete. Biomarkers found: ${parseResult.biomarkers.length}`);
      SocketService.emitPipeline(athleteId, 'OCR_PARSING', 'COMPLETED', { confidence: parseResult.confidence });
      
      // 3. Validate Extraction
      logger.info('🔍 Validating extraction results...');
      SocketService.emitPipeline(athleteId, 'VALIDATION', 'PROCESSING');
      const validation = ReportValidationService.validate(parseResult.biomarkers);
      logger.info(`✅ Validation complete: ${validation.isValid ? 'VALID' : 'FLAGGED'}`);
      SocketService.emitPipeline(athleteId, 'VALIDATION', 'COMPLETED', { valid: validation.isValid });

      // 4. Update Report with Extraction Results
      logger.info('💾 Updating report record with results...');
      SocketService.emitPipeline(athleteId, 'DATA_PERSISTENCE', 'PROCESSING');
      
      let updatedReport;
      try {
        updatedReport = await db.medicalReport.update({
          where: { id: report.id },
          data: {
            status: validation.isValid ? 'COMPLETED' : 'FLAGGED',
            ocrRawText: parseResult.rawText,
            extractedJSON: JSON.stringify(parseResult.biomarkers),
            ocrConfidence: parseResult.confidence,
            parsingConfidence: validation.qualityScore,
            validationStatus: validation.status,
            validationNotes: validation.notes.join('\n'),
            extractionQuality: validation.qualityScore > 0.8 ? 'EXCELLENT' : validation.qualityScore > 0.5 ? 'GOOD' : 'POOR'
          }
        });
      } catch (dbErr: any) {
        logger.error('❌ Failed to update report with extraction results', dbErr);
        SocketService.emitPipeline(athleteId, 'DATA_PERSISTENCE', 'FAILED', { error: 'Database update failed' });
        throw new Error(`Report update failed: ${dbErr.message}`);
      }
      SocketService.emitPipeline(athleteId, 'DATA_PERSISTENCE', 'COMPLETED');

      // 5. Create TestResult records
      if (parseResult.biomarkers.length > 0) {
        logger.info(`💾 Creating ${parseResult.biomarkers.length} test result entries...`);
        try {
          await db.testResult.createMany({
            data: parseResult.biomarkers.map(b => ({
              reportId: report.id,
              parameter: b.parameter,
              value: b.value,
              unit: b.unit
            }))
          });
        } catch (dbErr: any) {
          logger.error('❌ Failed to create test results', dbErr);
          SocketService.emitPipeline(athleteId, 'DATA_PERSISTENCE', 'FAILED', { error: 'Test results insertion failed' });
          throw new Error(`Test results insertion failed: ${dbErr.message}`);
        }
      }

      // 6. Automatically trigger AI Intelligence Pipeline
      let aiResult = null;
      if (parseResult.biomarkers.length > 0) {
        logger.info('🤖 Triggering AI intelligence pipeline...');
        SocketService.emitPipeline(athleteId, 'AI_SCAN', 'QUEUED');
        try {
          aiResult = await AIEngineService.analyzeAthleteAI(athleteId);
          SocketService.emitPipeline(athleteId, 'AI_SCAN', 'COMPLETED');
        } catch (aiErr: any) {
          logger.error('❌ AI Engine Analysis failed', aiErr);
          SocketService.emitPipeline(athleteId, 'AI_SCAN', 'FAILED', { error: 'AI Analysis failed' });
          // We don't strictly throw here to allow ingestion success even if AI fails
        }
      }

      logger.info('🎉 Ingestion pipeline completed successfully');
      SocketService.emitPipeline(athleteId, 'INGESTION', 'COMPLETED');
      
      res.status(201).json({
        status: 'success',
        message: 'Report ingested successfully',
        data: {
          reportId: report.id,
          validation,
          biomarkers: parseResult.biomarkers,
          aiTriggered: !!aiResult
        }
      });

    } catch (error: any) {
      logger.error('❌ Ingestion Error:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Ingestion failed: ' + error.message 
      });
    }
  }

  static async getIngestionHistory(req: Request, res: Response) {
    const { athleteId } = req.params;
    try {
      const reports = await db.medicalReport.findMany({
        where: { athleteId },
        orderBy: { createdAt: 'desc' },
        include: { testResults: true }
      });
      res.json({ reports });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
