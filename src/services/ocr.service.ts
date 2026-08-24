import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { logger } from '../utils/logger.js';

/**
 * Real optical character recognition for scanned lab reports (images).
 *
 * Uses tesseract.js (a WASM build of Tesseract OCR) which runs fully locally.
 *
 * The English trained-data model (`eng.traineddata.gz`) is loaded from a local
 * directory (default `<project>/data/tessdata`, override with TESSDATA_PATH) so
 * no network call is needed at request time. `npm run setup` downloads it; if it
 * is absent, we fall back to tesseract's default remote fetch.
 */
export class OcrService {
  private static localLangPath(): string | undefined {
    const dir = process.env.TESSDATA_PATH || path.resolve(process.cwd(), 'data/tessdata');
    return fs.existsSync(path.join(dir, 'eng.traineddata.gz')) ? dir : undefined;
  }

  /**
   * Extracts text from an image file.
   * @returns the recognised text and a 0..1 confidence score.
   * @throws a descriptive Error if OCR is unavailable — never crashes the process.
   */
  static async recognize(filePath: string): Promise<{ text: string; confidence: number }> {
    const langPath = this.localLangPath();
    if (!langPath) {
      logger.warn('OCR model not found locally; attempting tesseract default fetch (requires internet). Run `npm run setup` to cache it.');
    }

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker('eng', undefined, {
        ...(langPath ? { langPath, cacheMethod: 'none', gzip: true } : {}),
        logger: () => {},
        errorHandler: (err: unknown) => logger.error('Tesseract worker error', err),
      });

      const { data } = await worker.recognize(filePath);
      const text = (data.text || '').trim();
      const confidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
      logger.info(`🔎 OCR complete: ${text.length} chars, confidence ${(confidence * 100).toFixed(1)}%`);
      return { text, confidence };
    } catch (err: any) {
      throw new Error(
        `OCR failed (${err?.message || 'unknown error'}). Ensure the OCR model is available — run \`npm run setup\` or set TESSDATA_PATH.`,
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          /* ignore terminate errors */
        }
      }
    }
  }
}
