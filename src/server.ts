import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { SocketService } from './services/socket.service.js';
import { db } from './services/db.js';

async function startServer() {
  try {
    const app = await createApp();
    const server = http.createServer(app);
    const port = config.PORT;

    // Initialize Socket.IO
    SocketService.init(server);

    server.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running in ${config.NODE_ENV} mode on http://0.0.0.0:${port}`);
    });

    // Graceful shutdown — close the HTTP server and DB pool cleanly.
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await db.$disconnect();
        } catch {
          /* ignore */
        }
        process.exit(0);
      });
      // Force-exit if it hangs.
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Log unexpected errors but keep the server alive — a single bad request
// (e.g. an OCR/worker failure) must not take down the whole service. Fatal
// startup errors are still handled by the try/catch above.
process.on('unhandledRejection', (err: unknown) => {
  logger.error('Unhandled promise rejection (kept alive):', err);
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception (kept alive):', err);
});

startServer();
