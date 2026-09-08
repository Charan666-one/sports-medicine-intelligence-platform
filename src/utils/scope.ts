import { Request } from 'express';
import { db } from '../services/db.js';
import { UnauthorizedError, NotFoundError } from '../errors/AppError.js';

/**
 * Multi-tenant scoping helpers.
 *
 * Every authenticated request carries `req.user.organizationId` (set by the
 * `protect` middleware). These helpers make it easy for controllers to (a) read
 * the caller's organization and (b) ensure a referenced athlete actually belongs
 * to that organization before acting on it — preventing cross-tenant access.
 */

export function orgId(req: Request): string {
  const id = req.user?.organizationId;
  if (!id) throw new UnauthorizedError('No organization context on this request.');
  return id;
}

/**
 * Ensures the athlete exists AND belongs to the caller's organization.
 * Throws NotFoundError (404) otherwise — never leaks another tenant's data.
 */
export async function assertAthleteInOrg(req: Request, athleteId: string) {
  const athlete = await db.athlete.findFirst({
    where: { id: athleteId, organizationId: orgId(req), deletedAt: null },
  });
  if (!athlete) throw new NotFoundError('Athlete not found');
  return athlete;
}
