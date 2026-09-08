import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../services/db.js';
import { config } from '../config/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/AppError.js';
import { AuditService } from '../services/audit.service.js';
import { RefreshTokenService, RefreshMeta } from '../services/refreshToken.service.js';
import { MfaService } from '../services/mfa.service.js';

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

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const mfaChallengeSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(1),
});

const mfaEnableSchema = z.object({ code: z.string().min(1) });
const mfaDisableSchema = z.object({ password: z.string().min(1) });

function signToken(user: { id: string; role?: { name?: string } | null }): string {
  return jwt.sign(
    { id: user.id, role: user.role?.name ?? 'USER' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

/**
 * A deliberately narrow-purpose token: proves the password step passed for
 * this user, nothing else. `scope: 'mfa_pending'` is checked and rejected
 * by the `protect` middleware, so this can never be used as a normal
 * bearer token even if it leaks — it is only ever accepted by
 * `mfaChallenge` below, and only for 5 minutes.
 */
function signMfaChallengeToken(userId: string): string {
  return jwt.sign({ id: userId, scope: 'mfa_pending' }, config.JWT_SECRET, { expiresIn: '5m' });
}

function publicUser(user: any) {
  // mfaSecret is decrypted transparently by the db layer on every read
  // (src/services/db.ts ENCRYPTED_FIELDS) — it must never reach a response.
  const { password, mfaSecret, ...rest } = user;
  return rest;
}

function requestMeta(req: Request): RefreshMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
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
      const refreshToken = await RefreshTokenService.issue(user.id, requestMeta(req));
      res.status(201).json({ status: 'success', data: { token, refreshToken, user: publicUser(user) } });
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

      if (user.mfaEnabled) {
        // Password step passed, but the session isn't live yet — no access/
        // refresh tokens, no "logged in" audit entry until MFA also passes.
        await AuditService.log({ userId: user.id, action: 'USER_LOGIN_MFA_PENDING', details: `Password verified for ${email}, awaiting MFA code`, req });
        return res.json({ status: 'success', data: { mfaRequired: true, mfaToken: signMfaChallengeToken(user.id) } });
      }

      await AuditService.log({ userId: user.id, action: 'USER_LOGIN', details: `Login ${email}`, req });
      const token = signToken(user);
      const refreshToken = await RefreshTokenService.issue(user.id, requestMeta(req));
      res.json({ status: 'success', data: { token, refreshToken, user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }

  /** Second step of MFA-gated login: exchanges a valid mfaToken + TOTP/backup code for real session tokens. */
  static async mfaChallenge(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = mfaChallengeSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('mfaToken and code are required.');

      let decoded: { id: string; scope?: string };
      try {
        decoded = jwt.verify(parsed.data.mfaToken, config.JWT_SECRET) as { id: string; scope?: string };
      } catch {
        throw new UnauthorizedError('Invalid or expired MFA session. Please log in again.');
      }
      if (decoded.scope !== 'mfa_pending') throw new UnauthorizedError('Invalid MFA session token.');

      const user = await db.user.findUnique({ where: { id: decoded.id }, include: { role: true } });
      if (!user || user.isActive === false) throw new UnauthorizedError('Account no longer active.');

      const valid = await MfaService.verifyLoginCode(user.id, parsed.data.code);
      if (!valid) {
        await AuditService.log({ userId: user.id, action: 'USER_LOGIN_MFA_FAILED', details: `Invalid MFA code for ${user.email}`, req });
        throw new UnauthorizedError('Invalid verification code.');
      }

      await AuditService.log({ userId: user.id, action: 'USER_LOGIN', details: `Login ${user.email} (MFA verified)`, req });
      const token = signToken(user);
      const refreshToken = await RefreshTokenService.issue(user.id, requestMeta(req));
      res.json({ status: 'success', data: { token, refreshToken, user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }

  /** Starts MFA enrollment: generates a pending secret + QR code. Not yet enabled. */
  static async mfaSetup(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedError('Not authenticated.');
      const { otpauthUrl, qrCodeDataUrl } = await MfaService.setup(user.id, user.email);
      res.json({ status: 'success', data: { otpauthUrl, qrCodeDataUrl } });
    } catch (error) {
      next(error);
    }
  }

  /** Confirms enrollment with a real code from the authenticator app; returns one-time backup codes. */
  static async mfaEnable(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedError('Not authenticated.');
      const parsed = mfaEnableSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('code is required.');

      const { backupCodes } = await MfaService.enable(user.id, parsed.data.code);
      await AuditService.log({ userId: user.id, action: 'MFA_ENABLED', details: `MFA enabled for ${user.email}`, req });
      res.json({ status: 'success', data: { backupCodes } });
    } catch (error) {
      next(error);
    }
  }

  /** Disables MFA. Requires re-entering the current password as a safety check. */
  static async mfaDisable(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedError('Not authenticated.');
      const parsed = mfaDisableSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('password is required.');

      const ok = await bcrypt.compare(parsed.data.password, user.password);
      if (!ok) throw new UnauthorizedError('Incorrect password.');

      await MfaService.disable(user.id);
      await AuditService.log({ userId: user.id, action: 'MFA_DISABLED', details: `MFA disabled for ${user.email}`, req });
      res.json({ status: 'success', data: { message: 'MFA disabled.' } });
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

  /**
   * Exchanges a valid (unexpired, unused) refresh token for a new access
   * token + a newly-rotated refresh token. The presented refresh token is
   * consumed — reusing it afterward revokes the whole session chain.
   */
  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('refreshToken is required.');

      const { userId, refreshToken } = await RefreshTokenService.rotate(parsed.data.refreshToken, requestMeta(req));
      const user = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
      if (!user || user.isActive === false) throw new UnauthorizedError('Account no longer active.');

      const token = signToken(user);
      res.json({ status: 'success', data: { token, refreshToken, user: publicUser(user) } });
    } catch (error) {
      next(error);
    }
  }

  /** Revokes the presented refresh token (logout on this device). */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (parsed.success) {
        await RefreshTokenService.revoke(parsed.data.refreshToken);
      }
      res.json({ status: 'success', data: { message: 'Logged out.' } });
    } catch (error) {
      next(error);
    }
  }
}
