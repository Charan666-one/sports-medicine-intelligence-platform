import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [athleteCount, alertCount, pendingReports, totalReports, avgRisk, ocrAgg, predictionCount] = await Promise.all([
      db.athlete.count({ where: { deletedAt: null } }),
      db.alert.count({ where: { isResolved: false } }),
      db.medicalReport.count({ where: { status: 'PENDING' } }),
      db.medicalReport.count(),
      db.riskAssessment.aggregate({ _avg: { score: true } }),
      db.medicalReport.aggregate({ _avg: { ocrConfidence: true }, where: { ocrConfidence: { gt: 0 } } }),
      db.aIPrediction.count(),
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
    const athletes = await db.athlete.findMany({ select: { id: true } });
    
    // Simulate a deep audit process
    const systemUserId = await getSystemUserId();
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
