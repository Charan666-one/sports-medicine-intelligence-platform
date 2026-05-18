import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.get('/', reportController.ReportController.getAllReports);
router.post('/', reportController.ReportController.createReport);
router.get('/:id', reportController.ReportController.getReportById);
router.post('/:id/summary', reportController.ReportController.generateAISummary);

export default router;
