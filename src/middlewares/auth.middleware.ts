import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import { db } from '../services/db.js';

interface TokenPayload {
  id: string;
  role: string;
  /** Present only on a short-lived MFA-challenge token (see auth.controller.ts). */
  scope?: string;
}

/**
 * Protect routes with JWT authentication. Attaches the current user (with role)
 * to req.user, or rejects with 401.
 */
export const protect = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token) {
      return next(new UnauthorizedError('You are not logged in. Please log in to get access.'));
    }

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch {
      return next(new UnauthorizedError('Invalid or expired token.'));
    }

    // Defense in depth: an MFA-challenge token (issued mid-login, before the
    // second factor is verified) must never work as a normal bearer token,
    // even though only mfaChallenge's own jwt.verify call currently accepts
    // it — this rejects it explicitly rather than relying on that alone.
    if (decoded.scope === 'mfa_pending') {
      return next(new UnauthorizedError('MFA verification required.'));
    }

    const currentUser = await db.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });
    if (!currentUser || currentUser.isActive === false) {
      return next(new UnauthorizedError('The user for this token no longer exists or is inactive.'));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    next(new UnauthorizedError('Authentication failed.'));
  }
};

/**
 * Restrict a route to specific roles (RBAC). Use after `protect`.
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user?.role?.name;
    if (!userRole || !roles.includes(userRole)) {
      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }
    next();
  };
};
