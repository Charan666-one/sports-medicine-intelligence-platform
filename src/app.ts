import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, corsOrigins } from './config/index.js';
import { httpLogger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { NotFoundError } from './errors/AppError.js';
import apiV1Routes from './routes/index.js';
import { db } from './services/db.js';
import IORedis from 'ioredis';

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

  // Liveness (public, unauthenticated): process is up and serving requests.
  // Deliberately checks nothing external — must stay fast and always-200 as
  // long as the process itself is healthy, so an orchestrator doesn't
  // restart a fine process just because a dependency blipped.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // Readiness (public, unauthenticated): can this instance actually serve
  // traffic right now? Checks the dependencies every request needs —
  // Postgres and Redis — and returns 503 (not 200) if either is
  // unreachable, so a load balancer/orchestrator stops routing to it
  // instead of returning errors to users.
  //
  // Deliberately NOT the shared BullMQ-tuned Redis factory: that one sets
  // maxRetriesPerRequest: null (retry forever), which is correct for a
  // queue worker but would make a health check hang indefinitely — a
  // service that never fails its health check when actually down is worse
  // than one that does, since nothing ever routes traffic away from it. A
  // fresh short-lived connection per check sidesteps any ambiguity around
  // reconnecting a persistent client after a failure.
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

  async function checkRedis(): Promise<boolean> {
    const client = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      /* surfaced via the timeout/rejection below; avoid an unhandled 'error' event */
    });
    try {
      await withTimeout(client.connect(), 2000);
      await withTimeout(client.ping(), 2000);
      return true;
    } catch {
      return false;
    } finally {
      client.disconnect();
    }
  }

  app.get('/api/health/ready', async (_req, res) => {
    const checks: Record<string, 'ok' | 'down'> = { database: 'down', redis: 'down' };

    try {
      await withTimeout(db.$queryRaw`SELECT 1`, 2000);
      checks.database = 'ok';
    } catch {
      /* left as 'down' */
    }

    if (await checkRedis()) checks.redis = 'ok';

    const allOk = Object.values(checks).every((v) => v === 'ok');
    res.status(allOk ? 200 : 503).json({ status: allOk ? 'ready' : 'not_ready', checks, timestamp: new Date().toISOString() });
  });

  // Rate limit all API traffic, then mount the versioned API.
  app.use('/api', apiLimiter);
  app.use('/api/v1', apiV1Routes);

  // API 404 — must run BEFORE the SPA/Vite fallback so unknown /api/* requests
  // get a JSON 404 instead of the frontend HTML shell.
  app.use('/api', (req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  // Frontend (Vite in dev, static build in prod). Dynamically imported so
  // `vite` (a devDependency — build-time only) never has to be resolvable
  // in the production runtime image.
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // Server runs from src/ (via tsx), so the built SPA is at <root>/dist,
    // i.e. one level up from this file's directory.
    const distPath = path.resolve(__dirname, '../dist');
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
