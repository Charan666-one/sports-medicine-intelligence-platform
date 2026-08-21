import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { ReportIngestionController } from '../controllers/reportIngestion.controller.js';
import { upload } from '../services/upload.service.js';

const router = Router();

router.get('/', reportController.ReportController.getAllReports);
router.post('/', reportController.ReportController.createReport);

/**
 * @route POST /api/v1/reports/ingest
 * @desc Upload a report WITHOUT pre-selecting an athlete. The athlete is
 *       auto-detected from the file and matched/created, then the document is
 *       parsed and real risk results are computed.
 */
router.post('/ingest', upload.single('file'), ReportIngestionController.ingestAutoMatch);

router.get('/:id', reportController.ReportController.getReportById);
router.post('/:id/summary', reportController.ReportController.generateAISummary);

export default router;
