import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Durable storage for uploaded medical reports (ENGINEERING_READINESS.md
 * blocker B1). `multer` always stages the incoming upload to a local file
 * first (see upload.service.ts) — this service decides what happens next:
 *
 *  - `local` driver (default): the staged file IS the storage. Nothing is
 *    moved or deleted; behavior is identical to before this existed. Fine
 *    for single-instance dev/demo use, NOT durable across redeploys or
 *    multiple instances.
 *  - `s3` driver: the staged file is uploaded to the configured bucket and
 *    then deleted locally. The persisted reference (`filePath` in
 *    IngestionJob/MedicalReport) becomes an `s3://<bucket>/<key>` URI
 *    instead of a filesystem path.
 *
 * Consumers that need to read the bytes (OCR/PDF/CSV parsing, which use
 * local `fs` APIs) call `materializeLocal()` first, which is a no-op for the
 * `local` driver and a download-to-temp-file for the `s3` driver.
 */

const S3_URI_PREFIX = 's3://';

function isS3Ref(ref: string): boolean {
  return ref.startsWith(S3_URI_PREFIX);
}

function parseS3Uri(uri: string): { bucket: string; key: string } {
  const rest = uri.slice(S3_URI_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) throw new Error(`Malformed S3 URI: ${uri}`);
  return { bucket: rest.slice(0, slashIndex), key: rest.slice(slashIndex + 1) };
}

// Lazily constructed — never touched unless STORAGE_DRIVER=s3 is actually
// configured, so `local`-driver dev/test/CI environments never need AWS
// credentials or the SDK to succeed at import time.
let s3Client: import('@aws-sdk/client-s3').S3Client | null = null;
async function getS3Client() {
  if (!s3Client) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: config.STORAGE_S3_REGION,
      endpoint: config.STORAGE_S3_ENDPOINT,
      forcePathStyle: config.STORAGE_S3_FORCE_PATH_STYLE,
      credentials:
        config.STORAGE_S3_ACCESS_KEY_ID && config.STORAGE_S3_SECRET_ACCESS_KEY
          ? { accessKeyId: config.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: config.STORAGE_S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  return s3Client;
}

export class StorageService {
  /**
   * Call once multer has staged an uploaded file locally. Returns the
   * reference to persist in the database (`filePath`). For the `local`
   * driver this is the same local path multer already wrote; for `s3` the
   * file is uploaded and the local staging copy is deleted.
   */
  static async persist(localStagedPath: string, fileName: string, mimeType: string): Promise<string> {
    if (config.STORAGE_DRIVER !== 's3') {
      return localStagedPath;
    }

    const bucket = config.STORAGE_S3_BUCKET!;
    const key = `medical-reports/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${path.extname(fileName)}`;
    const body = await fs.readFile(localStagedPath);

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getS3Client();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mimeType }));

    await fs.unlink(localStagedPath).catch((err) => {
      logger.warn(`Failed to remove local staging copy after S3 upload: ${err.message}`);
    });

    logger.info(`☁ Uploaded report to s3://${bucket}/${key}`);
    return `${S3_URI_PREFIX}${bucket}/${key}`;
  }

  /**
   * Guarantees a local filesystem path for `ref`, downloading from S3 to a
   * temp file first if needed. Always call `cleanup()` when done reading —
   * for the `local` driver it's a no-op (the file is the permanent storage
   * and must not be deleted); for `s3` it removes the temp download.
   */
  static async materializeLocal(ref: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
    if (!isS3Ref(ref)) {
      return { path: ref, cleanup: async () => {} };
    }

    const { bucket, key } = parseS3Uri(ref);
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getS3Client();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`S3 object body empty for ${ref}`);

    const tempPath = path.join(os.tmpdir(), `nexus-ingest-${crypto.randomUUID()}${path.extname(key)}`);
    const bytes = await result.Body.transformToByteArray();
    await fs.writeFile(tempPath, Buffer.from(bytes));

    return {
      path: tempPath,
      cleanup: async () => {
        await fs.unlink(tempPath).catch(() => {
          /* best-effort temp cleanup */
        });
      },
    };
  }
}
