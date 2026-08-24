import { describe, it, expect } from 'vitest';
import { CryptoService } from '../src/services/crypto.service.js';

describe('CryptoService (field encryption at rest)', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = 'Hemoglobin 18.1 g/dL — patient: Ivan Petrov';
    const encrypted = CryptoService.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(String(encrypted).startsWith('enc:v1:')).toBe(true);
    expect(CryptoService.decrypt(encrypted)).toBe(plaintext);
  });

  it('is idempotent — never double-encrypts', () => {
    const once = CryptoService.encrypt('secret');
    expect(CryptoService.encrypt(once)).toBe(once);
  });

  it('passes null/undefined through unchanged', () => {
    expect(CryptoService.encrypt(null)).toBeNull();
    expect(CryptoService.encrypt(undefined)).toBeUndefined();
    expect(CryptoService.decrypt(null)).toBeNull();
    expect(CryptoService.decrypt(undefined)).toBeUndefined();
  });

  it('returns legacy plaintext untouched on decrypt', () => {
    expect(CryptoService.decrypt('legacy plaintext value')).toBe('legacy plaintext value');
  });

  it('produces different ciphertext for the same input (random IV)', () => {
    expect(CryptoService.encrypt('same')).not.toBe(CryptoService.encrypt('same'));
  });
});
