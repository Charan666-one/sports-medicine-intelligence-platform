import crypto from 'crypto';
import { db } from './db.js';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export interface RefreshMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * Refresh tokens (Phase 9): the access JWT is short-lived (see
 * JWT_EXPIRES_IN); a session survives via an opaque, rotatable refresh
 * token instead of a long-lived JWT. Only the token's SHA-256 hash is ever
 * persisted — the raw token is returned to the client once and never
 * stored — so a database read alone can't be used to impersonate a session.
 *
 * Rotation: every refresh consumes the presented token and issues a new
 * one, linked via `replacedById`. If an already-consumed (or expired)
 * token is presented again, that is a strong signal of token theft (a
 * client using a copy of a token the legitimate session already rotated
 * past) — the entire chain for that user is revoked, forcing re-login
 * everywhere, rather than silently accepting the reused token.
 */
export class RefreshTokenService {
  private static hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /** Issues a new refresh token for a user, persisting only its hash. */
  static async issue(userId: string, meta: RefreshMeta = {}): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(rawToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip?.slice(0, 100),
      },
    });
    return rawToken;
  }

  /**
   * A just-rotated token presented again within this window is treated as a
   * benign race (e.g. two near-simultaneous requests from the same browser
   * both got a 401 and both read the same not-yet-rotated token from shared
   * localStorage before either write landed) rather than theft. Reuse of a
   * token older than this is the real signal — an attacker replaying a
   * token the legitimate client already moved past.
   */
  private static REUSE_GRACE_MS = 15_000;

  /** Validates and rotates a refresh token. Returns the userId and the new raw refresh token. */
  static async rotate(rawToken: string, meta: RefreshMeta = {}): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = this.hash(rawToken);
    const existing = await db.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    if (existing.revokedAt) {
      const withinGrace = Date.now() - existing.revokedAt.getTime() < this.REUSE_GRACE_MS;
      if (withinGrace && existing.replacedById) {
        const liveTip = await this.findLiveTip(existing.replacedById);
        if (liveTip) return this.mintFrom(liveTip, meta);
      }
      // Reuse of a token outside the grace window: possible theft — the
      // legitimate client already rotated past this token. Revoke every
      // active token for this user so all sessions must re-authenticate.
      logger.warn(`⚠ Refresh token reuse detected for user ${existing.userId} — revoking all sessions.`);
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedError('Refresh token already used. Please log in again.');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired. Please log in again.');
    }

    return this.mintFrom(existing, meta);
  }

  /** Follows the replacedById chain forward to the current still-live token, if any. */
  private static async findLiveTip(tokenId: string, depth = 0): Promise<{ id: string; userId: string } | null> {
    if (depth > 10) return null; // defensive bound; chains this long shouldn't occur
    const token = await db.refreshToken.findUnique({ where: { id: tokenId } });
    if (!token) return null;
    if (!token.revokedAt) return token.expiresAt > new Date() ? token : null;
    if (!token.replacedById) return null;
    return this.findLiveTip(token.replacedById, depth + 1);
  }

  /** Revokes `existing` and mints a fresh token descending from it. */
  private static async mintFrom(
    existing: { id: string; userId: string },
    meta: RefreshMeta,
  ): Promise<{ userId: string; refreshToken: string }> {
    const newRawToken = crypto.randomBytes(32).toString('base64url');
    const newExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const newToken = await db.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: this.hash(newRawToken),
        expiresAt: newExpiresAt,
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip?.slice(0, 100),
      },
    });
    await db.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: newToken.id },
    });

    return { userId: existing.userId, refreshToken: newRawToken };
  }

  /** Revokes a single refresh token (logout on this device/session). */
  static async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active refresh token for a user (logout everywhere / theft response). */
  static async revokeAllForUser(userId: string): Promise<void> {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
