import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { config, corsOrigins } from './config/index.js';
import { httpLogger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { NotFoundError } from './errors/AppError.js';
import apiV1Routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();
  const isProd = config.NODE_ENV === 'production';

  // Trust the first proxy so req.ip / rate limiting work behind a load balancer.
  app.set('trust proxy', 1);

  // Security headers. In production we enable a Content-Security-Policy; in dev
  // it is disabled so the Vite dev client (inline scripts / HMR) works.
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
    }),
  );

  app.use(cors({ origin: corsOrigins, credentials: true }));

  // Body parsing with a size limit to blunt large-payload DoS.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(httpLogger);

  // Health check (public, unauthenticated).
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // Rate limit all API traffic, then mount the versioned API.
  app.use('/api', apiLimiter);
  app.use('/api/v1', apiV1Routes);

  // API 404 — must run BEFORE the SPA/Vite fallback so unknown /api/* requests
  // get a JSON 404 instead of the frontend HTML shell.
  app.use('/api', (req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  // Frontend (Vite in dev, static build in prod).
  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../../dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Catch-all 404 (non-API) and centralized error handler.
  app.use((req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });
  app.use(errorHandler);

  return app;
}
