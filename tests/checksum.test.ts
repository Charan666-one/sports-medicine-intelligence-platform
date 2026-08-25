import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sha256File, sha256Json } from '../src/utils/checksum.js';

describe('sha256File', () => {
  const tmpFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpFiles.splice(0).map((f) => fs.unlink(f).catch(() => {})));
  });

  async function writeTmp(content: string): Promise<string> {
    const p = path.join(os.tmpdir(), `checksum-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    await fs.writeFile(p, content);
    tmpFiles.push(p);
    return p;
  }

  it('produces the same digest for identical file contents (idempotency basis)', async () => {
    const a = await writeTmp('parameter,value,unit\nHemoglobin,15,g/dL\n');
    const b = await writeTmp('parameter,value,unit\nHemoglobin,15,g/dL\n');
    expect(await sha256File(a)).toBe(await sha256File(b));
  });

  it('produces different digests for different file contents', async () => {
    const a = await writeTmp('parameter,value,unit\nHemoglobin,15,g/dL\n');
    const b = await writeTmp('parameter,value,unit\nHemoglobin,16,g/dL\n');
    expect(await sha256File(a)).not.toBe(await sha256File(b));
  });

  it('returns a 64-character lowercase hex digest', async () => {
    const a = await writeTmp('x');
    const digest = await sha256File(a);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('sha256Json (analysis input hashing — Phase 8 reproducibility)', () => {
  it('is stable regardless of object key insertion order', () => {
    const a = { hemoglobin: 15, epo: 5, hematocrit: 45 };
    const b = { hematocrit: 45, hemoglobin: 15, epo: 5 };
    expect(sha256Json(a)).toBe(sha256Json(b));
  });

  it('produces different digests for different values', () => {
    expect(sha256Json({ hemoglobin: 15 })).not.toBe(sha256Json({ hemoglobin: 16 }));
  });

  it('is stable across repeated calls with the same input (reproducibility)', () => {
    const input = { hemoglobin: 19.3, epo: 23.1, testosteroneRatio: 7.9 };
    expect(sha256Json(input)).toBe(sha256Json({ ...input }));
  });

  it('returns a 64-character lowercase hex digest', () => {
    expect(sha256Json({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
