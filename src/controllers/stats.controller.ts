import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { orgId } from '../utils/scope.js';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = orgId(req);
    const byAthlete = { athlete: { organizationId } };
    const [athleteCount, alertCount, pendingReports, totalReports, avgRisk, ocrAgg, predictionCount] = await Promise.all([
      db.athlete.count({ where: { deletedAt: null, organizationId } }),
      db.alert.count({ where: { isResolved: false, ...byAthlete } }),
      db.medicalReport.count({ where: { status: 'PENDING', ...byAthlete } }),
      db.medicalReport.count({ where: byAthlete }),
      db.riskAssessment.aggregate({ _avg: { score: true }, where: byAthlete }),
      db.medicalReport.aggregate({ _avg: { ocrConfidence: true }, where: { ocrConfidence: { gt: 0 }, ...byAthlete } }),
      db.aIPrediction.count({ where: byAthlete }),
    ]);

    // Real OCR/extraction accuracy from ingested documents (0 → no data yet).
    const ocrExtractionRate = ocrAgg._avg.ocrConfidence ? Number((ocrAgg._avg.ocrConfidence * 100).toFixed(1)) : 0;

    res.json({
      status: 'success',
      data: {
        totalAthletes: athleteCount,
        activeAlerts: alertCount,
        pendingReports,
        totalReports,
        avgRisk: avgRisk._avg.score || 0,
        ocrExtractionRate,
        intelligencePredictions: predictionCount,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const runGlobalAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athletes = await db.athlete.findMany({
      where: { deletedAt: null, organizationId: orgId(req) },
      select: { id: true },
    });

    // Record the audit against the caller's organization.
    const systemUserId = req.user?.id ?? (await getSystemUserId());
    await db.auditLog.create({
      data: {
        tableName: 'SYSTEM',
        recordId: 'GLOBAL',
        operation: 'AUDIT',
        newValue: `System-wide audit performed on ${athletes.length} athletes`,
        changedBy: systemUserId
      }
    });

    res.json({
      status: 'success',
      data: {
        timestamp: new Date().toISOString(),
        auditedAthletes: athletes.length,
        status: 'COMPLETED'
      }
    });
  } catch (error) {
    next(error);
  }
};
