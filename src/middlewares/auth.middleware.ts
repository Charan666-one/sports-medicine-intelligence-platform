import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import { db } from '../services/db.js';

interface TokenPayload {
  id: string;
  role: string;
}

/**
 * Middleware to protect routes with JWT authentication.
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('You are not logged in. Please log in to get access.');
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;

    // Check if user still exists
    const currentUser = await db.user.findUnique({ where: { id: decoded.id } });
    if (!currentUser) {
      throw new UnauthorizedError('The user belonging to this token no longer exists.');
    }

    // Grant access to protected route
    (req as any).user = currentUser;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid token or expired.'));
  }
};

/**
 * Middleware to restrict access based on user roles.
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      throw new ForbiddenError('You do not have permission to perform this action.');
    }
    next();
  };
};
