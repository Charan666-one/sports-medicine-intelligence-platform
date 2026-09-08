import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import { createApp } from '../src/app.js';
import { db } from '../src/services/db.js';

/**
 * End-to-end MFA-gated login (readiness blocker B2), through the real HTTP
 * routes — not just MfaService directly (see tests/mfa.service.test.ts).
 * Covers the full account lifecycle: register -> enable MFA -> log out ->
 * log back in and confirm the password step alone no longer grants access.
 */
describe('MFA-gated login (end-to-end)', () => {
  let app: Express;
  const suffix = Date.now();
  const email = `mfa-e2e-${suffix}@test.local`;
  const password = 'TestPassword123!';

  let accessToken: string;

  const cryptoPlugin = new NobleCryptoPlugin();
  const base32Plugin = new ScureBase32Plugin();
  async function generateCode(secret: string): Promise<string> {
    return new TOTP({ secret, crypto: cryptoPlugin, base32: base32Plugin }).generate();
  }

  beforeAll(async () => {
    app = await createApp();
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'MFA E2E User', organizationName: `MFA E2E Org ${suffix}` });
    expect(register.status).toBe(201);
    accessToken = register.body.data.token;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('a plain (non-MFA) login still works before MFA is enabled', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.mfaRequired).toBeFalsy();
  });

  let mfaSecret: string;
  let backupCode: string;

  it('mfa/setup returns a pending secret + QR code without enabling MFA yet', async () => {
    const res = await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    mfaSecret = new URL(res.body.data.otpauthUrl.replace('otpauth://totp/', 'http://x/')).searchParams.get('secret')!;
    expect(mfaSecret).toBeTruthy();

    // Still logs in without MFA — setup alone doesn't gate anything.
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.body.data.mfaRequired).toBeFalsy();
  });

  it('mfa/enable with a real code turns MFA on and returns backup codes', async () => {
    const code = await generateCode(mfaSecret);
    const res = await request(app)
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code });
    expect(res.status).toBe(200);
    expect(res.body.data.backupCodes).toHaveLength(8);
    backupCode = res.body.data.backupCodes[0];
  });

  let mfaToken: string;

  it('login now returns mfaRequired + a challenge token instead of real session tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.mfaRequired).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
    mfaToken = res.body.data.mfaToken;
    expect(mfaToken).toBeTruthy();
  });

  it('the mfaToken cannot be used as a normal bearer token (defense in depth)', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${mfaToken}`);
    expect(res.status).toBe(401);
  });

  it('mfa/challenge rejects a wrong code', async () => {
    const res = await request(app).post('/api/v1/auth/mfa/challenge').send({ mfaToken, code: '000000' });
    expect(res.status).toBe(401);
  });

  it('mfa/challenge with a correct TOTP code completes login and issues real session tokens', async () => {
    const code = await generateCode(mfaSecret);
    const res = await request(app).post('/api/v1/auth/mfa/challenge').send({ mfaToken, code });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.mfaSecret).toBeUndefined(); // never serialized

    // The new access token works normally.
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
  });

  it('mfa/challenge also accepts an unused backup code, exactly once', async () => {
    const freshLogin = await request(app).post('/api/v1/auth/login').send({ email, password });
    const freshMfaToken = freshLogin.body.data.mfaToken;

    const first = await request(app).post('/api/v1/auth/mfa/challenge').send({ mfaToken: freshMfaToken, code: backupCode });
    expect(first.status).toBe(200);

    const secondLogin = await request(app).post('/api/v1/auth/login').send({ email, password });
    const reuse = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .send({ mfaToken: secondLogin.body.data.mfaToken, code: backupCode });
    expect(reuse.status).toBe(401); // already consumed
  });

  it('mfa/disable requires the correct password and then turns MFA off', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'not-the-password' });
    expect(wrongPassword.status).toBe(401);

    const ok = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password });
    expect(ok.status).toBe(200);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.body.data.mfaRequired).toBeFalsy();
    expect(login.body.data.token).toBeTruthy();
  });
});
