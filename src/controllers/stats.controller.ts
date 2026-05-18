import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athleteCount = await db.athlete.count();
    const alertCount = await db.alert.count({ where: { isResolved: false } });
    const pendingReports = await db.medicalReport.count({ where: { status: 'PENDING' } });
    
    // Average risk score
    const avgRisk = await db.riskAssessment.aggregate({
      _avg: { score: true }
    });

    res.json({
      status: 'success',
      data: {
        totalAthletes: athleteCount,
        activeAlerts: alertCount,
        pendingReports,
        avgRisk: avgRisk._avg.score || 0
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
