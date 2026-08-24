import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { BiomarkerExtractionService } from './biomarkerExtraction.service.js';
import { NormalizationService, NormalizedBiomarker } from './normalization.service.js';
import { OcrService } from './ocr.service.js';

export interface ParsingResult {
  rawText: string;
  biomarkers: NormalizedBiomarker[];
  confidence: number;
}

export class DocumentParserService {
  /**
   * Parses a medical document (PDF, image, or CSV) and extracts biomarkers.
   * All paths compute real results from the uploaded file — no simulated data.
   */
  static async parseDocument(filePath: string, mimeType: string): Promise<ParsingResult> {
    if (mimeType === 'application/pdf') {
      return this.parsePdf(filePath);
    }
    if (mimeType === 'text/csv' || filePath.toLowerCase().endsWith('.csv')) {
      return this.parseCsv(filePath);
    }
    if (mimeType.startsWith('image/')) {
      return this.parseImage(filePath);
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  private static async parsePdf(filePath: string): Promise<ParsingResult> {
    const dataBuffer = await fs.readFile(filePath);
    try {
      // Timeout guards against corrupted / huge PDFs hanging the request.
      const parsePromise = pdf(dataBuffer);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF parsing timed out after 15 seconds')), 15000),
      );
      const data: any = await Promise.race([parsePromise, timeoutPromise]);

      if (!data || !data.text) {
        throw new Error('No text content found in PDF');
      }

      const rawText = this.sanitize(data.text);
      if (rawText.length < 50) {
        throw new Error('Extracted text is too short. PDF may be a scanned image without a text layer — upload it as an image instead.');
      }

      const confidence = Math.min(0.98, 0.75 + rawText.length / 20000);
      return { rawText, biomarkers: BiomarkerExtractionService.extract(rawText), confidence };
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }
  }

  // ── Image (real OCR) ────────────────────────────────────────────────────────
  private static async parseImage(filePath: string): Promise<ParsingResult> {
    const { text, confidence } = await OcrService.recognize(filePath);
    const rawText = this.sanitize(text);
    if (rawText.length < 3) {
      throw new Error('OCR produced no readable text. The image may be blank, rotated, or too low-resolution.');
    }
    return { rawText, biomarkers: BiomarkerExtractionService.extract(rawText), confidence };
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────
  private static async parseCsv(filePath: string): Promise<ParsingResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const rows = content
      .split(/\r\n|\r|\n/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (rows.length === 0) {
      throw new Error('CSV file is empty.');
    }

    const splitRow = (row: string) => row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

    // Detect an optional header row and map columns.
    const first = splitRow(rows[0]).map((c) => c.toLowerCase());
    let paramIdx = 0, valueIdx = 1, unitIdx = 2;
    let startIdx = 0;

    const looksLikeHeader = first.some((c) => ['parameter', 'name', 'marker', 'test', 'analyte'].includes(c));
    if (looksLikeHeader) {
      const find = (names: string[], fallback: number) => {
        const i = first.findIndex((c) => names.includes(c));
        return i === -1 ? fallback : i;
      };
      paramIdx = find(['parameter', 'name', 'marker', 'test', 'analyte'], 0);
      valueIdx = find(['value', 'result', 'reading'], 1);
      unitIdx = find(['unit', 'units', 'uom'], 2);
      startIdx = 1;
    }

    const biomarkers: NormalizedBiomarker[] = [];
    const textLines: string[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const cols = splitRow(rows[i]);
      const name = cols[paramIdx];
      const value = cols[valueIdx];
      const unit = cols[unitIdx] ?? '';
      if (!name || value === undefined) continue;

      textLines.push(`${name}: ${value} ${unit}`.trim());
      const normalized = NormalizationService.normalize(name, value, unit);
      if (normalized && !biomarkers.find((b) => b.parameter === normalized.parameter)) {
        biomarkers.push(normalized);
      }
    }

    const rawText = textLines.join('\n');
    // High structural confidence for CSV since values are already tabular.
    const confidence = biomarkers.length > 0 ? 0.95 : 0.4;
    return { rawText, biomarkers, confidence };
  }

  // ── Shared text cleanup ──────────────────────────────────────────────────────
  private static sanitize(input: string): string {
    return input
      .replace(/\r\n|\r|\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '')
      .replace(/ +/g, ' ')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n')
      .trim();
  }
}
