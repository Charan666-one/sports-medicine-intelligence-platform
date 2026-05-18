import morgan from 'morgan';
import { config } from '../config/index.js';

/**
 * Production-grade logging wrapper.
 * In a real-world app, this would use Winston or Pino.
 * For this phase, we use a structured console logger.
 */
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  debug: (message: string, meta?: any) => {
    if (config.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
};

export const httpLogger = morgan(
  config.NODE_ENV === 'development' ? 'dev' : 'combined'
);
