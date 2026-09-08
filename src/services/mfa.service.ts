import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import qrcode from 'qrcode';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.js';

const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();
const ISSUER = 'NEXUS Sports Medicine';

function totp(secret?: string, label?: string): TOTP {
  return new TOTP({ secret, issuer: ISSUER, label, crypto: cryptoPlugin, base32: base32Plugin });
}

/**
 * Verifies with ±30s tolerance for clock drift between server and the
 * user's authenticator app. `TOTP.verify()` THROWS (rather than returning
 * `{valid: false}`) on a malformed token — e.g. anything that isn't 6
 * digits — which matters here because a backup code (an alphanumeric hex
 * string) gets tried against this too; without this guard, checking a
 * backup code would crash instead of just failing over to the backup-code
 * lookup. Caught here, not by making backup codes numeric, since a wrong
 * *TOTP* code (6 digits, just incorrect) must still return a clean `false`.
 */
async function verifyCode(instance: TOTP, token: string): Promise<boolean> {
  try {
    const result = await instance.verify(token, { epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * TOTP-based multi-factor authentication (readiness blocker B2). An account
 * handling athlete medical/anti-doping data should not be protected by a
 * password alone. Flow:
 *
 *  1. setup()   — generates a secret, stores it (mfaEnabled stays false
 *                 until proven), returns an otpauth:// URI + QR code.
 *  2. enable()  — the user proves possession of the secret with a real code
 *                 from their authenticator app; only then does mfaEnabled
 *                 flip to true, and one-time backup codes are issued.
 *  3. On login, verifyLoginCode() accepts either a live TOTP code or an
 *     unused backup code (single-use, consumed on success).
 *  4. disable() clears the secret and any remaining backup codes.
 */
export class MfaService {
  private static readonly BACKUP_CODE_COUNT = 8;

  /** Generates and persists a new (not-yet-enabled) secret; returns setup material. */
  static async setup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const secret = totp().generateSecret();
    await db.user.update({ where: { id: userId }, data: { mfaSecret: secret, mfaEnabled: false } });

    const otpauthUrl = totp(secret, email).toURI();
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Verifies a code against the pending secret and, if valid, enables MFA + issues backup codes. */
  static async enable(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new Error('No pending MFA setup for this user. Call setup first.');
    if (!(await verifyCode(totp(user.mfaSecret), code.trim()))) throw new Error('Invalid verification code.');

    const backupCodes = Array.from({ length: this.BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase(),
    );

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      db.mfaBackupCode.deleteMany({ where: { userId } }), // clear any codes from a prior enable/re-enable
      db.mfaBackupCode.createMany({
        data: await Promise.all(
          backupCodes.map(async (code) => ({ userId, codeHash: await bcrypt.hash(code, 10) })),
        ),
      }),
    ]);

    return { backupCodes };
  }

  /** Disables MFA and removes the secret + any remaining backup codes. */
  static async disable(userId: string): Promise<void> {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } }),
      db.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * Verifies a login-time code: a live TOTP code, or a single-use backup
   * code (consumed on success). Returns whether the code was valid.
   */
  static async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) return false;

    const normalized = code.trim().toUpperCase();

    if (await verifyCode(totp(user.mfaSecret), code.trim())) return true;

    // Not a valid TOTP code — try it as an unused backup code.
    const candidates = await db.mfaBackupCode.findMany({ where: { userId, usedAt: null } });
    for (const candidate of candidates) {
      if (await bcrypt.compare(normalized, candidate.codeHash)) {
        await db.mfaBackupCode.update({ where: { id: candidate.id }, data: { usedAt: new Date() } });
        return true;
      }
    }
    return false;
  }
}
