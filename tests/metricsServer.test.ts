import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createMetricsServer } from '../src/utils/metricsServer.js';
import { ingestionJobsTotal } from '../src/utils/metrics.js';

/**
 * The worker process's own metrics server (src/worker.ts). This exists
 * because ingestion_jobs_total is only ever incremented in the worker
 * process — a separate OS process from the API — so it's invisible on the
 * API's GET /api/metrics (prom-client's registry is in-memory, per-process).
 * Discovered via a live end-to-end demo: uploading a report and checking
 * the API's /api/metrics showed the HELP/TYPE lines but no data point for
 * ingestion_jobs_total, because nothing had ever incremented it in THAT
 * process. This test exercises the actual fix directly, not just the
 * always-present HELP/TYPE scaffolding metrics.test.ts checks.
 */
describe('worker metrics server (createMetricsServer)', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = createMetricsServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(() => {
    server.close();
  });

  it('serves Prometheus text format on /metrics, including a real ingestion_jobs_total data point', async () => {
    ingestionJobsTotal.inc({ status: 'completed' });

    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(body).toMatch(/^ingestion_jobs_total\{status="completed"\} \d+/m);
  });

  it('404s on any other path', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/not-metrics`);
    expect(res.status).toBe(404);
  });
});
