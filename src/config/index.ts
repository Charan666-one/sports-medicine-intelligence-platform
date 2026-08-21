import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1).default('super-secret-key-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  GEMINI_API_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const config = _env.data;

/**
 * Resolved Gemini API key.
 *
 * Returns `undefined` when the key is missing, blank, or still set to a known
 * placeholder value (e.g. the one shipped in `.env.example`). This prevents the
 * app from firing doomed requests to the Gemini API with an invalid key, which
 * previously spammed the logs with `API_KEY_INVALID` errors on every AI action.
 */
const GEMINI_PLACEHOLDERS = new Set([
  'MY_GEMINI_API_KEY',
  'your_gemini_api_key_here',
  'YOUR_API_KEY',
]);

export const geminiApiKey: string | undefined = (() => {
  const key = config.GEMINI_API_KEY?.trim();
  if (!key || GEMINI_PLACEHOLDERS.has(key)) return undefined;
  return key;
})();

/** True when a real (non-placeholder) Gemini API key is configured. */
export const isGeminiEnabled = Boolean(geminiApiKey);
