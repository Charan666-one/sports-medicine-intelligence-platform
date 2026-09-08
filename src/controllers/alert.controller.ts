import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { AuditService } from '../services/audit.service.js';
import { orgId } from '../utils/scope.js';
import { NotFoundError } from '../errors/AppError.js';

/** Confirms an alert exists AND belongs to the caller's org; else 404. */
async function assertAlertInOrg(req: Request, id: string) {
  const alert = await db.alert.findFirst({ where: { id, athlete: { organizationId: orgId(req) } } });
  if (!alert) throw new NotFoundError('Alert not found');
  return alert;
}

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await db.alert.findMany({
      where: { athlete: { organizationId: orgId(req) } },
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
    await assertAlertInOrg(req, id);
    const alert = await db.alert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() }
    });
    const actingUserId = req.user?.id ?? (await getSystemUserId());
    await AuditService.log({ userId: actingUserId, action: 'ALERT_RESOLVED', details: `Alert ${id} resolved`, req });
    await AuditService.record({ tableName: 'Alert', recordId: id, operation: 'UPDATE', changedBy: actingUserId, newValue: { isResolved: true } });
    res.json({ status: 'success', data: { alert } });
  } catch (error) {
    next(error);
  }
};

export const escalateAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertAlertInOrg(req, id);
    const alert = await db.alert.update({
      where: { id },
      data: { severity: 'CRITICAL' }
    });

    const actingUserId = req.user?.id ?? (await getSystemUserId());
    await db.activityLog.create({
      data: {
        userId: actingUserId,
        action: 'ALERT_ESCALATED',
        details: `Alert ${id} escalated to CRITICAL`
      }
    });

    res.json({ status: 'success', data: { alert } });
  } catch (error) {
    next(error);
  }
};
