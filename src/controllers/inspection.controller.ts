import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { logger } from '../utils/logger.js';
import { SocketService } from '../services/socket.service.js';
import { orgId, assertAthleteInOrg } from '../utils/scope.js';
import { NotFoundError } from '../errors/AppError.js';

export class InspectionController {
  static async createInspection(req: Request, res: Response, next: NextFunction) {
    try {
      const { athleteId, title, description, priority } = req.body;
      // Only open inspections against athletes in the caller's organization.
      await assertAthleteInOrg(req, athleteId);

      const inspection = await db.inspection.create({
        data: {
          athleteId,
          title,
          description,
          priority: priority || 'MEDIUM',
          status: 'OPEN'
        }
      });

      // Log activity
      const actingUserId = req.user?.id ?? (await getSystemUserId());
      await db.activityLog.create({
        data: {
          userId: actingUserId,
          action: 'INSPECTION_CREATED',
          details: `New inspection created for athlete ${athleteId}: ${title}`
        }
      });

      // Emit realtime update
      SocketService.emitActivity({
        type: 'INSPECTION_CREATED',
        message: `New manual inspection opened: ${title}`,
        severity: (priority === 'HIGH' || priority === 'CRITICAL') ? 'HIGH' : 'INFO',
        data: { athleteId, inspectionId: inspection.id }
      });

      res.status(201).json({
        status: 'success',
        data: { inspection }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAthleteInspections(req: Request, res: Response, next: NextFunction) {
    try {
      const { athleteId } = req.params;
      await assertAthleteInOrg(req, athleteId);
      const inspections = await db.inspection.findMany({
        where: { athleteId },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        status: 'success',
        data: { inspections }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateInspection(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      // Only update an inspection whose athlete is in the caller's organization.
      const existing = await db.inspection.findFirst({
        where: { id, athlete: { organizationId: orgId(req) } },
      });
      if (!existing) throw new NotFoundError('Inspection not found');

      const inspection = await db.inspection.update({
        where: { id },
        data
      });

      res.json({
        status: 'success',
        data: { inspection }
      });
    } catch (error) {
      next(error);
    }
  }
}
