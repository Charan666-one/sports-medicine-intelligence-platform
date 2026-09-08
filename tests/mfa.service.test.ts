import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import { db } from '../src/services/db.js';
import { MfaService } from '../src/services/mfa.service.js';

/**
 * TOTP-based MFA (readiness blocker B2). Runs against the real Postgres
 * instance (User/MfaBackupCode have real FK constraints), exercising
 * MfaService directly. Generates real, currently-valid TOTP codes against
 * the same secret the service stores — the same thing an authenticator app
 * would produce — rather than mocking the TOTP algorithm.
 */
describe('MfaService', () => {
  let userId: string;
  let userEmail: string;
  const suffix = Date.now();

  const cryptoPlugin = new NobleCryptoPlugin();
  const base32Plugin = new ScureBase32Plugin();
  async function generateCode(secret: string): Promise<string> {
    return new TOTP({ secret, crypto: cryptoPlugin, base32: base32Plugin }).generate();
  }

  beforeAll(async () => {
    const org = await db.organization.create({ data: { name: `MFA Test Org ${suffix}`, slug: `mfa-test-org-${suffix}` } });
    const role = await db.role.create({ data: { name: 'ADMIN', organizationId: org.id } });
    userEmail = `mfa-test-${suffix}@test.local`;
    const user = await db.user.create({
      data: { email: userEmail, password: 'irrelevant-not-used-by-these-tests', name: 'MFA Test User', organizationId: org.id, roleId: role.id },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('setup() persists a pending secret without enabling MFA', async () => {
    const { secret, otpauthUrl, qrCodeDataUrl } = await MfaService.setup(userId, userEmail);
    expect(secret).toBeTruthy();
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.mfaEnabled).toBe(false);
    expect(user?.mfaSecret).toBe(secret); // stored, but not yet active
  });

  it('enable() rejects an incorrect code and leaves MFA disabled', async () => {
    await expect(MfaService.enable(userId, '000000')).rejects.toThrow(/invalid/i);
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.mfaEnabled).toBe(false);
  });

  let backupCodes: string[];

  it('enable() with a real code from the pending secret turns MFA on and issues 8 backup codes', async () => {
    const user = await db.user.findUnique({ where: { id: userId } });
    const code = await generateCode(user!.mfaSecret!);

    const result = await MfaService.enable(userId, code);
    expect(result.backupCodes).toHaveLength(8);
    expect(new Set(result.backupCodes).size).toBe(8); // all distinct
    backupCodes = result.backupCodes;

    const updated = await db.user.findUnique({ where: { id: userId } });
    expect(updated?.mfaEnabled).toBe(true);
  });

  it('verifyLoginCode() accepts a real live TOTP code', async () => {
    const user = await db.user.findUnique({ where: { id: userId } });
    const code = await generateCode(user!.mfaSecret!);
    expect(await MfaService.verifyLoginCode(userId, code)).toBe(true);
  });

  it('verifyLoginCode() rejects a bogus code', async () => {
    expect(await MfaService.verifyLoginCode(userId, '000000')).toBe(false);
  });

  it('verifyLoginCode() accepts a backup code exactly once, then rejects it on reuse', async () => {
    const code = backupCodes[0];
    expect(await MfaService.verifyLoginCode(userId, code)).toBe(true);
    expect(await MfaService.verifyLoginCode(userId, code)).toBe(false); // consumed
  });

  it('verifyLoginCode() still accepts a different, still-unused backup code', async () => {
    const code = backupCodes[1];
    expect(await MfaService.verifyLoginCode(userId, code)).toBe(true);
  });

  it('disable() clears the secret and backup codes; nothing verifies afterward', async () => {
    const user = await db.user.findUnique({ where: { id: userId } });
    const secretBeforeDisable = user!.mfaSecret!;

    await MfaService.disable(userId);

    const updated = await db.user.findUnique({ where: { id: userId } });
    expect(updated?.mfaEnabled).toBe(false);
    expect(updated?.mfaSecret).toBeNull();

    const remainingBackupCodes = await db.mfaBackupCode.findMany({ where: { userId } });
    expect(remainingBackupCodes).toHaveLength(0);

    // The old secret no longer verifies anything — MFA is fully off, not
    // just flagged off while still checkable.
    const staleCode = await generateCode(secretBeforeDisable);
    expect(await MfaService.verifyLoginCode(userId, staleCode)).toBe(false);
  });
});
