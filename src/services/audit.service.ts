import { Request } from 'express';
import { db } from './db.js';
import { logger } from '../utils/logger.js';

/**
 * Centralised audit / activity logging.
 *
 * Records *who* did *what*, *when*, and *from where* into the ActivityLog table
 * (previously defined in the schema but never populated). Also mirrors data
 * mutations into the AuditLog table for tamper-evident change history.
 *
 * All methods are best-effort: an audit-logging failure must never break the
 * user-facing operation, so errors are swallowed and logged.
 */
export class AuditService {
  private static clientIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
    return req.ip;
  }

  /** Log a user/system action to the ActivityLog. */
  static async log(params: {
    userId: string;
    action: string;
    details?: string;
    req?: Request;
  }): Promise<void> {
    try {
      await db.activityLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          details: params.details,
          ipAddress: this.clientIp(params.req),
        },
      });
    } catch (err) {
      logger.warn('Audit log (activity) failed — continuing', (err as Error).message);
    }
  }

  /** Record a data change to the AuditLog (create/update/delete). */
  static async record(params: {
    tableName: string;
    recordId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    changedBy: string;
    oldValue?: unknown;
    newValue?: unknown;
  }): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          tableName: params.tableName,
          recordId: params.recordId,
          operation: params.operation,
          changedBy: params.changedBy,
          oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : undefined,
          newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : undefined,
        },
      });
    } catch (err) {
      logger.warn('Audit log (record) failed — continuing', (err as Error).message);
    }
  }
}
