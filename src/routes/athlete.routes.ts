import { Router } from 'express';
import * as athleteController from '../controllers/athlete.controller.js';
import { upload } from '../services/upload.service.js';
import { ReportIngestionController } from '../controllers/reportIngestion.controller.js';
import { AssistantController } from '../controllers/assistant.controller.js';

const router = Router();

/**
 * @route GET /api/v1/athletes
 * @desc Get all athletes with their latest reports
 * @access Public (for Phase 1)
 */
router.get('/', athleteController.getAllAthletes);
router.post('/', athleteController.createAthlete);

/**
 * @route GET /api/v1/athletes/:id
 * @desc Get detailed athlete profile
 * @access Public (for Phase 1)
 */

router.post('/recalculate-all', athleteController.recalculateAllAthletesRisk);

router.get('/:id', athleteController.getAthleteById);

/**
 * @route GET /api/v1/athletes/:id/statistics
 * @desc Get statistical anomaly insights for an athlete
 */
router.get('/:id/statistics', athleteController.getAthleteStatistics);

/**
 * @route POST /api/v1/athletes/:id/ai-analysis
 * @desc Trigger manual medical AI intelligence analysis
 */
router.post('/:id/ai-analysis', athleteController.runAthleteAIAnalysis);

/**
 * @route POST /api/v1/athletes/recalculate-all
 * @desc Trigger manual medical risk engine recalculation for ALL athletes
 */

/**
 * @route POST /api/v1/athletes/:id/recalculate
 * @desc Trigger manual medical risk engine recalculation
 */
router.post('/:id/recalculate', athleteController.recalculateAthleteRisk);

/**
 * @route POST /api/v1/athletes/:athleteId/ingest
 * @desc Ingest real medical laboratory document
 */
router.post('/:athleteId/ingest', upload.single('report'), ReportIngestionController.ingestReport);

/**
 * @route GET /api/v1/athletes/:athleteId/ingestion-history
 * @desc Get ingestion history for an athlete
 */
router.get('/:athleteId/ingestion-history', ReportIngestionController.getIngestionHistory);

/**
 * @route POST /api/v1/athletes/:athleteId/assistant/ask
 * @desc Ask the AI assistant about an athlete
 */
router.post('/:athleteId/assistant/ask', AssistantController.ask);

export default router;
