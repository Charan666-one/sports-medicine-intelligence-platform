import { Router } from 'express';
import {
  getAntiDopingOverview,
  getRiskTrend,
  getMarkerVariance,
  getLongitudinal,
} from '../controllers/analytics.controller.js';
import { runGlobalAudit } from '../controllers/stats.controller.js';

// Mounted at /api/v1/analytics
export const analyticsRouter = Router();
analyticsRouter.get('/risk-trend', getRiskTrend);

// Mounted at /api/v1/anti-doping
export const antiDopingRouter = Router();
antiDopingRouter.get('/overview', getAntiDopingOverview);
antiDopingRouter.get('/marker-variance', getMarkerVariance);
antiDopingRouter.get('/longitudinal', getLongitudinal);
antiDopingRouter.post('/run-audit', runGlobalAudit);
