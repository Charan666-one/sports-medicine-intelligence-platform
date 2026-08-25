import crypto from 'crypto';
import fs from 'fs/promises';

/** SHA-256 hex digest of a file's bytes — used to detect duplicate uploads. */
export async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}
