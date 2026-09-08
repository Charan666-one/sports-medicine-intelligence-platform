import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),

  // Secrets — required and length-checked. No insecure fallback in production.
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default(isProd ? '' : 'dev-only-insecure-secret-change-me-0123456789'),
  // Short-lived by design (Phase 9): a leaked/stolen access token now has a
  // small blast-radius window. Sessions stay alive via the refresh token
  // below, rotated on each use.
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),

  // 32-byte key (hex = 64 chars, or base64) for AES-256-GCM field encryption.
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters (32-byte key)')
    .default(isProd ? '' : 'dev-only-insecure-encryption-key-0123456789abcdef'),

  // Comma-separated allowed origins. In production this must be set explicitly.
  CORS_ORIGIN: z.string().default(isProd ? '' : '*'),

  GEMINI_API_KEY: z.string().optional(),

  // Redis connection for the ingestion queue (BullMQ). Required for both the
  // API process (to enqueue jobs and receive worker events) and the worker.
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  // Uploaded medical report storage. `local` (default) writes to the
  // container's own disk — fine for a single-instance dev/demo setup, but NOT
  // durable: it does not survive a redeploy/restart on most PaaS targets and
  // is not shared between the API and worker if either ever scales to more
  // than one instance. `s3` persists to an S3-compatible bucket instead
  // (AWS S3, or any S3-compatible endpoint like MinIO/R2/Backblaze via
  // STORAGE_S3_ENDPOINT). See ENGINEERING_READINESS.md blocker B1.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().default('us-east-1'),
  // Only needed for non-AWS S3-compatible providers (MinIO, R2, etc). Leave
  // unset to use real AWS S3.
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Path-style addressing (bucket.example.com/key vs example.com/bucket/key)
  // — required by most self-hosted S3-compatible servers.
  STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  // Optional bearer token gating GET /api/metrics. Metrics reveal internal
  // topology (route templates, request volume) but no tenant data — low
  // sensitivity, but not zero, so this is available for deployments that
  // can't restrict the path at the ingress/network layer instead. Unset =
  // open, matching the existing /api/health(/ready) precedent.
  METRICS_TOKEN: z.string().optional(),

  // The worker is a SEPARATE OS process from the API (see src/worker.ts) —
  // metrics recorded there (ingestion_jobs_total) live in that process's own
  // memory and are invisible on the API's /api/metrics. The worker exposes
  // its own tiny metrics HTTP server on this port; a real deployment scrapes
  // both targets. This is the standard pattern for multi-process Node apps
  // with prom-client, not a workaround.
  WORKER_METRICS_PORT: z.coerce.number().default(9091),
})
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.JWT_SECRET) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'JWT_SECRET is required in production' });
      }
      if (!env.ENCRYPTION_KEY) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ENCRYPTION_KEY'], message: 'ENCRYPTION_KEY is required in production' });
      }
      if (!env.CORS_ORIGIN || env.CORS_ORIGIN === '*') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'CORS_ORIGIN must be an explicit origin list in production (not "*")' });
      }
    }
    if (env.STORAGE_DRIVER === 's3' && !env.STORAGE_S3_BUCKET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STORAGE_S3_BUCKET'], message: 'STORAGE_S3_BUCKET is required when STORAGE_DRIVER=s3' });
    }
  });

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const config = _env.data;

/** Allowed CORS origins as an array, or '*' for any (dev only). */
export const corsOrigins: string | string[] =
  config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Resolved Gemini API key. Returns `undefined` when missing, blank, or a known
 * placeholder, so the app never fires doomed requests with an invalid key.
 */
const GEMINI_PLACEHOLDERS = new Set(['MY_GEMINI_API_KEY', 'your_gemini_api_key_here', 'YOUR_API_KEY']);
export const geminiApiKey: string | undefined = (() => {
  const key = config.GEMINI_API_KEY?.trim();
  if (!key || GEMINI_PLACEHOLDERS.has(key)) return undefined;
  return key;
})();
export const isGeminiEnabled = Boolean(geminiApiKey);
