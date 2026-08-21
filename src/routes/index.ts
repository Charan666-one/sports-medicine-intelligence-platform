import { Router } from 'express';
import athleteRoutes from './athlete.routes.js';
import reportRoutes from './report.routes.js';
import alertRoutes from './alert.routes.js';
import inspectionRoutes from './inspection.routes.js';
import authRoutes from './auth.routes.js';
import { getDashboardStats, runGlobalAudit } from '../controllers/stats.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * Public authentication endpoints.
 */
router.use('/auth', authRoutes);

/**
 * Everything below requires a valid JWT. Anti-doping / medical data is never
 * served to unauthenticated callers.
 */
router.use(protect);

router.get('/stats', getDashboardStats);
router.post('/audit', runGlobalAudit);
router.use('/athletes', athleteRoutes);
router.use('/reports', reportRoutes);
router.use('/alerts', alertRoutes);
router.use('/inspections', inspectionRoutes);

export default router;
