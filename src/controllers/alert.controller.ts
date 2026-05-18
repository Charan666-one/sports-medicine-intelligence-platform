import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await db.alert.findMany({
      include: { athlete: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ status: 'success', data: { alerts } });
  } catch (error) {
    next(error);
  }
};

export const resolveAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const alert = await db.alert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() }
    });
    res.json({ status: 'success', data: { alert } });
  } catch (error) {
    next(error);
  }
};

export const escalateAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const alert = await db.alert.update({
      where: { id },
      data: { severity: 'CRITICAL' }
    });

    const systemUserId = await getSystemUserId();
    await db.activityLog.create({
      data: {
        userId: systemUserId,
        action: 'ALERT_ESCALATED',
        details: `Alert ${id} escalated to CRITICAL`
      }
    });

    res.json({ status: 'success', data: { alert } });
  } catch (error) {
    next(error);
  }
};
