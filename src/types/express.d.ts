import type { User, Role } from '@prisma/client';

/**
 * Augments Express' Request with the authenticated user attached by the
 * `protect` middleware, so controllers can use `req.user` with full typing
 * instead of `(req as any).user`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User & { role?: Role | null };
    }
  }
}

export {};
