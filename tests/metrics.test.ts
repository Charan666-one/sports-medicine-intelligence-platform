import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';

/**
 * Operational metrics endpoint (ENGINEERING_READINESS.md blocker B4).
 * Runs against the real Express app (like the authorization integration
 * suite) rather than mocking Express, since what matters here is that the
 * duration-recording middleware and the route actually wire together.
 */
describe('GET /api/metrics', () => {
  afterEach(() => {
    vi.doUnmock('../src/config/index.js');
    vi.resetModules();
  });

  it('is open by default (no METRICS_TOKEN configured) and exposes Prometheus text format', async () => {
    const { createApp } = await import('../src/app.js');
    const app = await createApp();

    // Exercise a route first so http_request_duration_seconds has at least
    // one observation with a real route-template label.
    await request(app).get('/api/health');

    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('ingestion_jobs_total');
    // Default Node process metrics (from prom-client's collectDefaultMetrics).
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  it('rejects requests without the correct bearer token when METRICS_TOKEN is configured', async () => {
    vi.doMock('../src/config/index.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/config/index.js')>();
      return { ...actual, config: { ...actual.config, METRICS_TOKEN: 'secret-scrape-token' } };
    });

    const { createApp } = await import('../src/app.js');
    const app = await createApp();

    const unauthenticated = await request(app).get('/api/metrics');
    expect(unauthenticated.status).toBe(401);

    const wrongToken = await request(app).get('/api/metrics').set('Authorization', 'Bearer wrong');
    expect(wrongToken.status).toBe(401);

    const authenticated = await request(app).get('/api/metrics').set('Authorization', 'Bearer secret-scrape-token');
    expect(authenticated.status).toBe(200);
  });
});
