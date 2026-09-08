import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

/**
 * API documentation (readiness blocker B3). openapi.yaml is validated
 * structurally in a separate step (`npm run docs:validate`, wired into
 * CI) — this test is about the serving wiring: the app actually exposes
 * it, and the served JSON is the same document (paths/auth actually
 * match what's implemented, not a stale copy).
 */
describe('API documentation endpoints', () => {
  it('GET /api/openapi.json serves the OpenAPI document, unauthenticated', async () => {
    const app = await createApp();
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths).toHaveProperty('/api/v1/auth/login');
    expect(res.body.paths).toHaveProperty('/api/v1/athletes');
    expect(res.body.paths).toHaveProperty('/api/v1/auth/mfa/setup');
  });

  it('GET /api/docs serves the Swagger UI page, unauthenticated', async () => {
    const app = await createApp();
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });
});
