import http from 'http';
import { register } from './metrics.js';

/**
 * A minimal metrics-only HTTP server, extracted from src/worker.ts so it can
 * be tested without needing to boot a real BullMQ worker. The worker process
 * has no other HTTP server of its own — this is the ONLY way its metrics
 * (ingestion_jobs_total, which is only ever incremented in that process) are
 * reachable, since separate OS processes don't share prom-client's
 * in-memory registry with the API's /api/metrics.
 */
export function createMetricsServer(): http.Server {
  return http.createServer(async (req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}
