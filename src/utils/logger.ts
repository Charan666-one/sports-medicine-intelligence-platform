import pino from 'pino';
import pinoHttp from 'pino-http';
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

/** HTTP request logger middleware (replaces morgan). */
export const httpLogger = pinoHttp({
  logger: pinoInstance,
  // Quieten health checks; keep everything else.
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
