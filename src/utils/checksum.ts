import crypto from 'crypto';
import fs from 'fs/promises';

/** SHA-256 hex digest of a file's bytes — used to detect duplicate uploads. */
export async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * SHA-256 hex digest of a JSON-serializable value, with object keys sorted
 * so the digest is stable regardless of key insertion order. Used to tie an
 * analysis result back to the exact input that produced it (reproducibility
 * / audit — Phase 8), independent of file bytes.
 */
export function sha256Json(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
