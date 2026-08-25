import { PrismaClient } from '@prisma/client';
import { CryptoService } from './crypto.service.js';

/**
 * Singleton Prisma Client for the entire app.
 *
 * Query-level logging is intentionally disabled: raw SQL contains patient
 * medical values (biomarkers, PII), so logging every query would leak sensitive
 * data into stdout/log aggregators. Only warnings and errors are emitted.
 * Set PRISMA_DEBUG=true to temporarily enable verbose query logs in development.
 */
const verbose = process.env.PRISMA_DEBUG === 'true';

/**
 * Field-level encryption at rest. These free-text fields can contain the raw
 * contents of a medical document (patient data, biomarker values, notes) and are
 * transparently encrypted on write / decrypted on read via a client extension.
 * TestResult numeric values stay in the clear so the risk engine can query them.
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  MedicalReport: ['ocrRawText', 'extractedJSON', 'validationNotes', 'dataQualityFindings'],
  AthleteMedicalProfile: ['allergies', 'history'],
  BiologicalPassport: ['hematologicalMarkers', 'steroidalMarkers'],
};

function encryptData(model: string, data: any) {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data || typeof data !== 'object') return data;
  const apply = (obj: any) => {
    for (const f of fields) {
      if (obj[f] !== undefined && obj[f] !== null && typeof obj[f] === 'string') {
        obj[f] = CryptoService.encrypt(obj[f]);
      }
    }
  };
  if (Array.isArray(data)) data.forEach(apply);
  else apply(data);
  return data;
}

function decryptResult(model: string, result: any) {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !result || typeof result !== 'object') return result;
  const apply = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    for (const f of fields) {
      if (typeof obj[f] === 'string') obj[f] = CryptoService.decrypt(obj[f]);
    }
  };
  if (Array.isArray(result)) result.forEach(apply);
  else apply(result);
  return result;
}

const base = new PrismaClient({
  log: verbose ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Encrypt inputs on write operations.
        if (ENCRYPTED_FIELDS[model]) {
          if ((operation === 'create' || operation === 'update' || operation === 'updateMany') && (args as any).data) {
            (args as any).data = encryptData(model, (args as any).data);
          } else if (operation === 'createMany' && (args as any).data) {
            (args as any).data = encryptData(model, (args as any).data);
          } else if (operation === 'upsert') {
            if ((args as any).create) (args as any).create = encryptData(model, (args as any).create);
            if ((args as any).update) (args as any).update = encryptData(model, (args as any).update);
          }
        }

        const result = await query(args);

        // Decrypt outputs on read/write operations that return records.
        if (ENCRYPTED_FIELDS[model]) return decryptResult(model, result);
        return result;
      },
    },
  },
});

export const db = prisma;
