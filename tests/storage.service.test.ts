import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function writeTmp(content: string): Promise<string> {
  const p = path.join(os.tmpdir(), `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fs.writeFile(p, content);
  return p;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('StorageService — local driver (default, no AWS config needed)', () => {
  const tmpFiles: string[] = [];
  afterEach(async () => {
    await Promise.all(tmpFiles.splice(0).map((f) => fs.unlink(f).catch(() => {})));
    vi.resetModules();
  });

  it('persist() passes the staged local path through unchanged and leaves the file in place', async () => {
    const { StorageService } = await import('../src/services/storage.service.js');
    const staged = await writeTmp('report bytes');
    tmpFiles.push(staged);

    const ref = await StorageService.persist(staged, 'report.pdf', 'application/pdf');

    expect(ref).toBe(staged);
    expect(await exists(staged)).toBe(true);
  });

  it('materializeLocal() on a non-s3 reference is a no-op passthrough (path unchanged, cleanup does not delete)', async () => {
    const { StorageService } = await import('../src/services/storage.service.js');
    const staged = await writeTmp('report bytes');
    tmpFiles.push(staged);

    const { path: resolved, cleanup } = await StorageService.materializeLocal(staged);
    expect(resolved).toBe(staged);

    await cleanup();
    // The local driver's file IS the permanent storage — cleanup must never
    // delete it (only a downloaded s3 temp copy should be removed).
    expect(await exists(staged)).toBe(true);
  });
});

describe('StorageService — s3 driver', () => {
  afterEach(() => {
    vi.doUnmock('../src/config/index.js');
    vi.doUnmock('@aws-sdk/client-s3');
    vi.resetModules();
  });

  it('persist() uploads to S3, deletes the local staging copy, and returns an s3:// reference', async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    vi.doMock('../src/config/index.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/config/index.js')>();
      return {
        ...actual,
        config: { ...actual.config, STORAGE_DRIVER: 's3', STORAGE_S3_BUCKET: 'nexus-reports-test' },
      };
    });
    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: vi.fn().mockImplementation(function (this: any) { this.send = sendMock; }),
      PutObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
      GetObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
    }));

    const { StorageService } = await import('../src/services/storage.service.js');
    const staged = await writeTmp('report bytes');

    const ref = await StorageService.persist(staged, 'report.pdf', 'application/pdf');

    expect(ref).toMatch(/^s3:\/\/nexus-reports-test\/medical-reports\/.+\.pdf$/);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(await exists(staged)).toBe(false); // local staging copy removed after upload
  });

  it('materializeLocal() downloads an s3:// reference to a temp file, and cleanup() removes it', async () => {
    const fileBytes = Buffer.from('downloaded report bytes');
    const sendMock = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array(fileBytes) },
    });
    vi.doMock('../src/config/index.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/config/index.js')>();
      return {
        ...actual,
        config: { ...actual.config, STORAGE_DRIVER: 's3', STORAGE_S3_BUCKET: 'nexus-reports-test' },
      };
    });
    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: vi.fn().mockImplementation(function (this: any) { this.send = sendMock; }),
      PutObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
      GetObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
    }));

    const { StorageService } = await import('../src/services/storage.service.js');
    const { path: localPath, cleanup } = await StorageService.materializeLocal(
      's3://nexus-reports-test/medical-reports/2026-08-25/some-key.pdf',
    );

    expect(await fs.readFile(localPath)).toEqual(fileBytes);
    expect(sendMock).toHaveBeenCalledTimes(1);

    await cleanup();
    expect(await exists(localPath)).toBe(false);
  });
});
