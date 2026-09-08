import { createIngestionWorker } from './queues/ingestion.worker.js';
import { SocketService } from './services/socket.service.js';
import { db } from './services/db.js';
import { logger } from './utils/logger.js';
import { createMetricsServer } from './utils/metricsServer.js';
import { config } from './config/index.js';

/**
 * Ingestion worker process entrypoint.
 *
 * Same codebase and image as the API (`src/server.ts`), started with a
 * different command (`npm run worker`). This is a deliberate queue-worker
 * split, not a microservice: it shares models, services, and the Prisma
 * client with the API, and is deployed from the same Docker image.
 */
async function main() {
  logger.info('🚀 Starting ingestion worker process...');

  // Realtime events (pipeline progress, AI scan / anomaly notifications) are
  // published to Redis here and relayed to clients by the API process's
  // subscriber (see SocketService).
  SocketService.initPublisher();

  const worker = createIngestionWorker();
  logger.info('✔ Ingestion worker ready and listening for jobs.');

  // ingestion_jobs_total is only ever incremented here, in this process —
  // it would never appear on the API's /api/metrics otherwise (separate OS
  // processes don't share prom-client's in-memory registry). A real
  // deployment scrapes this alongside the API's endpoint.
  const metricsServer = createMetricsServer();
  metricsServer.listen(config.WORKER_METRICS_PORT, () => {
    logger.info(`✔ Worker metrics listening on :${config.WORKER_METRICS_PORT}/metrics`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}. Shutting down gracefully...`);
    try {
      await worker.close();
      await SocketService.closeBridge();
      await db.$disconnect();
      metricsServer.close();
    } catch (err) {
      logger.error('Error during worker shutdown', err);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

process.on('unhandledRejection', (err: unknown) => {
  logger.error('Unhandled promise rejection in worker (kept alive):', err);
});
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception in worker (kept alive):', err);
});

main().catch((err) => {
  logger.error('Fatal error starting worker:', err);
  process.exit(1);
});
