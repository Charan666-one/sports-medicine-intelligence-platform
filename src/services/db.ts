import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma Client for the entire app.
 *
 * Query-level logging is intentionally disabled: raw SQL contains patient
 * medical values (biomarkers, PII), so logging every query would leak sensitive
 * data into stdout/log aggregators. Only warnings and errors are emitted.
 * Set PRISMA_DEBUG=true to temporarily enable verbose query logs in development.
 */
const verbose = process.env.PRISMA_DEBUG === 'true';

const prisma = new PrismaClient({
  log: verbose ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export const db = prisma;
