import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Field-level encryption for PII / sensitive medical data at rest.
 *
 * Uses AES-256-GCM (authenticated encryption). Ciphertext is stored as:
 *   enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 * The `enc:v1:` prefix lets us detect already-encrypted values and remain
 * backward-compatible with plaintext rows written before encryption existed.
 */
const PREFIX = 'enc:v1:';

function deriveKey(): Buffer {
  // Accept a 64-char hex key, a base64 key, or any passphrase — normalise to
  // a stable 32-byte key via SHA-256 so configuration is forgiving.
  const raw = config.ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

const KEY = deriveKey();

export class CryptoService {
  static isEncrypted(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  static encrypt(plaintext: string | null | undefined): string | null | undefined {
    if (plaintext === null || plaintext === undefined) return plaintext;
    if (this.isEncrypted(plaintext)) return plaintext; // already encrypted
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  static decrypt(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    if (!this.isEncrypted(value)) return value; // legacy plaintext — return as-is
    try {
      const [, , ivB64, tagB64, dataB64] = value.split(':');
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(tagB64, 'base64');
      const data = Buffer.from(dataB64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
      return plaintext.toString('utf8');
    } catch {
      // Wrong key or tampered ciphertext — never crash, surface a redacted marker.
      return '[decryption-failed]';
    }
  }
}
