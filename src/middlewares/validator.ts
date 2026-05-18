import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';
import { BadRequestError } from '../errors/AppError.js';

/**
 * Higher-order middleware to validate request data against a Zod schema.
 */
export const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        return next(new BadRequestError(message));
      }
      next(error);
    }
  };
};
