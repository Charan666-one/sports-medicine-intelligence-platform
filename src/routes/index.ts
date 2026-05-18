import { Router } from 'express';
import athleteRoutes from './athlete.routes.js';
import reportRoutes from './report.routes.js';
import alertRoutes from './alert.routes.js';
import inspectionRoutes from './inspection.routes.js';
import { getDashboardStats, runGlobalAudit } from '../controllers/stats.controller.js';

const router = Router();

/**
 * Enterprise API Versioning Pattern
 */
router.get('/stats', getDashboardStats);
router.post('/audit', runGlobalAudit);
router.use('/athletes', athleteRoutes);
router.use('/reports', reportRoutes);
router.use('/alerts', alertRoutes);
router.use('/inspections', inspectionRoutes);

// Future routes:
// router.use('/reports', reportRoutes);
// router.use('/auth', authRoutes);

export default router;
