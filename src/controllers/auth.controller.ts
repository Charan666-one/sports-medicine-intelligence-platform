import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../services/db.js';
import { config } from '../config/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/AppError.js';
import { AuditService } from '../services/audit.service.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  organizationName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user: { id: string; role?: { name?: string } | null }): string {
  return jwt.sign(
    { id: user.id, role: user.role?.name ?? 'USER' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

function publicUser(user: any) {
  const { password, ...rest } = user;
  return rest;
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
      }
      const { email, password, name, organizationName } = parsed.data;

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) throw new BadRequestError('An account with this email already exists.');

      // Self-registration ALWAYS provisions an isolated organization, so a
      // public signup can never attach itself to an existing tenant's data.
      // (Joining an existing org must go through an invite/admin flow.)
      const orgName = organizationName?.trim() || `${name}'s Workspace`;
      const slug = `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const org = await db.organization.create({ data: { name: orgName, slug } });
      // The first user of a new workspace owns it (ADMIN of their own org).
      const role = await db.role.create({
        data: { name: 'ADMIN', organizationId: org.id, description: 'Workspace owner' },
      });

      const hashed = await bcrypt.hash(password, 12);
      const user = await db.user.create({
        data: { email, password: hashed, name, organizationId: org.id, roleId: role.id },
        include: { role: true },
      });

      await AuditService.log({
        userId: user.id,
        action: 'USER_REGISTER',
        details: `New account ${email} (isolated org ${org.id})`,
        req,
      });
      const token = signToken(user);
      res.status(201).json({ status: 'success', data: { token, user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('Email and password are required.');
      const { email, password } = parsed.data;

      const user = await db.user.findUnique({ where: { email }, include: { role: true } });
      // Constant-ish response: always run a compare to reduce user-enumeration timing.
      const ok = user ? await bcrypt.compare(password, user.password) : await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
      if (!user || !ok || user.isActive === false) {
        throw new UnauthorizedError('Invalid email or password.');
      }

      await AuditService.log({ userId: user.id, action: 'USER_LOGIN', details: `Login ${email}`, req });
      const token = signToken(user);
      res.json({ status: 'success', data: { token, user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedError('Not authenticated.');
      res.json({ status: 'success', data: { user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }
}
