import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/services/db.js';
import { RefreshTokenService } from '../src/services/refreshToken.service.js';

/**
 * Refresh token rotation + reuse detection (Phase 9). This is the most
 * security-critical logic added this session — a real reuse-window bug was
 * found and fixed via live/manual testing during development — but had zero
 * automated regression coverage until now. Runs against the real Postgres
 * instance (RefreshToken rows have real FK constraints to User), exercising
 * RefreshTokenService directly rather than through HTTP, since the behavior
 * under test lives entirely in that service.
 */
describe('RefreshTokenService — rotation and reuse detection', () => {
  let userId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const org = await db.organization.create({ data: { name: `Refresh Test Org ${suffix}`, slug: `refresh-test-org-${suffix}` } });
    const role = await db.role.create({ data: { name: 'ADMIN', organizationId: org.id } });
    const user = await db.user.create({
      data: {
        email: `refresh-test-${suffix}@test.local`,
        password: 'irrelevant-not-used-by-these-tests',
        name: 'Refresh Test User',
        organizationId: org.id,
        roleId: role.id,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('issue() then rotate() succeeds, returns the correct userId, and issues a different token', async () => {
    const raw = await RefreshTokenService.issue(userId);
    const { userId: rotatedUserId, refreshToken: rotated } = await RefreshTokenService.rotate(raw);
    expect(rotatedUserId).toBe(userId);
    expect(rotated).not.toBe(raw);
  });

  it('rejects an unknown token', async () => {
    await expect(RefreshTokenService.rotate('not-a-real-token')).rejects.toThrow(/invalid refresh token/i);
  });

  it('rejects rotating an expired (but not yet revoked) token', async () => {
    const raw = await RefreshTokenService.issue(userId);
    const hash = (await import('crypto')).createHash('sha256').update(raw).digest('hex');
    await db.refreshToken.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(RefreshTokenService.rotate(raw)).rejects.toThrow(/expired/i);
  });

  it('within the grace window, reusing a just-rotated token is forgiven (benign race) rather than triggering theft revocation', async () => {
    const raw = await RefreshTokenService.issue(userId);
    const first = await RefreshTokenService.rotate(raw); // rotates `raw`, revokedAt = now

    // A second near-simultaneous request presenting the same now-rotated
    // `raw` token (e.g. two tabs reading the same pre-rotation localStorage
    // value) is treated as benign, not theft. Raw tokens are never stored
    // (only hashes), so the service can't hand back `first.refreshToken`
    // verbatim — instead it follows the chain to the live tip and mints a
    // further descendant, i.e. it does NOT throw and does NOT revoke the
    // session, unlike genuine out-of-grace reuse (see the next test).
    const second = await RefreshTokenService.rotate(raw);
    expect(second.userId).toBe(userId);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // The session is still alive end-to-end: the newest token continues to
    // rotate normally, proving this wasn't silently treated as theft.
    const third = await RefreshTokenService.rotate(second.refreshToken);
    expect(third.userId).toBe(userId);
  });

  it('outside the grace window, reusing an already-rotated token is treated as theft: throws AND revokes every active token for the user', async () => {
    const rawA = await RefreshTokenService.issue(userId);
    const rawB = await RefreshTokenService.issue(userId); // a second, independent live session
    const { refreshToken: rotatedFromA } = await RefreshTokenService.rotate(rawA);

    // Simulate the grace window having elapsed: backdate the revocation
    // timestamp on the now-rotated `rawA` token directly (REUSE_GRACE_MS is
    // an internal implementation detail, not something tests should reach
    // into — backdating the DB row is the black-box equivalent of "time
    // passed").
    const hash = (await import('crypto')).createHash('sha256').update(rawA).digest('hex');
    await db.refreshToken.update({
      where: { tokenHash: hash },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await expect(RefreshTokenService.rotate(rawA)).rejects.toThrow(/already used/i);

    // Theft response: EVERY active token for this user is revoked, including
    // the legitimate session's current token (rotatedFromA) and the
    // completely unrelated second session (rawB) — full re-login required.
    await expect(RefreshTokenService.rotate(rotatedFromA)).rejects.toThrow();
    await expect(RefreshTokenService.rotate(rawB)).rejects.toThrow();
  });

  it('revoke() invalidates a single token immediately (logout on one device)', async () => {
    const raw = await RefreshTokenService.issue(userId);
    await RefreshTokenService.revoke(raw);
    await expect(RefreshTokenService.rotate(raw)).rejects.toThrow();
  });

  it('revokeAllForUser() invalidates every active token for that user (logout everywhere)', async () => {
    const rawA = await RefreshTokenService.issue(userId);
    const rawB = await RefreshTokenService.issue(userId);
    await RefreshTokenService.revokeAllForUser(userId);
    await expect(RefreshTokenService.rotate(rawA)).rejects.toThrow();
    await expect(RefreshTokenService.rotate(rawB)).rejects.toThrow();
  });
});
