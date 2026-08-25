import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { config } from '../config/index.js';

const isProd = config.NODE_ENV === 'production';

/**
 * Structured application logger (pino). Pretty-printed in development, JSON in
 * production. `redact` strips common secret/PII fields so they never reach logs.
 */
const pinoInstance = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'token',
      '*.token',
    ],
    censor: '[redacted]',
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

/**
 * Backwards-compatible facade so existing call sites (`logger.info(msg, meta)`)
 * keep working while emitting structured pino logs.
 */
export const logger = {
  info: (message: string, meta?: unknown) => pinoInstance.info(meta ?? {}, message),
  error: (message: string, error?: unknown) =>
    pinoInstance.error(error instanceof Error ? { err: error } : (error ?? {}), message),
  warn: (message: string, meta?: unknown) => pinoInstance.warn(meta ?? {}, message),
  debug: (message: string, meta?: unknown) => pinoInstance.debug(meta ?? {}, message),
};

/**
 * HTTP request logger middleware (replaces morgan). Every request gets a
 * request ID (Phase 10 API quality): reused from an inbound `X-Request-Id`
 * header if an upstream proxy/load balancer already set one, otherwise a
 * fresh UUID. It's attached to every log line for that request (via
 * pino-http's genReqId) AND echoed back as a response header, so a client
 * report ("this request failed") can be correlated straight to server logs.
 */
export const httpLogger = pinoHttp({
  logger: pinoInstance,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (typeof existing === 'string' && existing) || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Quieten health checks; keep everything else.
  autoLogging: { ignore: (req) => req.url === '/api/health' || req.url === '/api/health/ready' },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
