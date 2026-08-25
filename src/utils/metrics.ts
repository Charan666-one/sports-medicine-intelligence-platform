import client from 'prom-client';

/**
 * Operational metrics (ENGINEERING_READINESS.md blocker B4). Before this,
 * the only signal an operator had was the readiness endpoint (up/down) —
 * no request-rate, latency, error-rate, or ingestion-pipeline-health signal
 * existed anywhere. This is a standard Prometheus text-format exporter, not
 * a new service: one process-local registry, scraped by whatever
 * Prometheus-compatible collector the deployment already runs.
 */

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

/** Every HTTP response, labeled by method/route-template/status — route
 * template (e.g. `/athletes/:id`), never the literal path, to keep
 * cardinality bounded regardless of how many athletes/reports exist. */
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

/** Terminal outcome of every ingestion job the worker processes — the one
 * metric that answers "is the async pipeline actually keeping up / healthy"
 * without an operator having to read logs. */
export const ingestionJobsTotal = new client.Counter({
  name: 'ingestion_jobs_total',
  help: 'Total ingestion jobs processed, by terminal status',
  labelNames: ['status'],
  registers: [register],
});
