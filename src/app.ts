import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { config } from './config/index.js';
import { httpLogger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './errors/AppError.js';
import apiV1Routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for development/iframe compatibility
  }));
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());
  app.use(httpLogger);

  // API Routes (to be expanded)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // API Route Scalability Pattern: API Versioning
  app.use('/api/v1', apiV1Routes);

  // Vite Integration
  if (config.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 404 Handler
  app.use((req, res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
