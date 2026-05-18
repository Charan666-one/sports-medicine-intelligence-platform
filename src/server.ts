import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { SocketService } from './services/socket.service.js';

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
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
  process.exit(1);
});

startServer();
