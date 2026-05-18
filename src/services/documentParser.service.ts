import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { BiomarkerExtractionService } from './biomarkerExtraction.service.js';
import { NormalizedBiomarker } from './normalization.service.js';

export interface ParsingResult {
  rawText: string;
  biomarkers: NormalizedBiomarker[];
  confidence: number;
}

export class DocumentParserService {
  /**
   * Parses a medical document (PDF or Image)
   */
  static async parseDocument(filePath: string, mimeType: string): Promise<ParsingResult> {
    const dataBuffer = await fs.readFile(filePath);
    let rawText = '';
    let confidence = 0.8; // Default base confidence

    if (mimeType === 'application/pdf') {
      try {
        // Implement a timeout to prevent hanging on corrupted/huge PDFs
        const parsePromise = pdf(dataBuffer);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF parsing timed out after 15 seconds')), 15000)
        );
        
        const data: any = await Promise.race([parsePromise, timeoutPromise]);
        
        if (!data || !data.text) {
          throw new Error('No text content found in PDF');
        }

        // Deep text sanitization
        rawText = data.text
          .replace(/\r\n|\r|\n/g, '\n') // Normalize line breaks
          .replace(/\t/g, ' ')           // Tabs to space
          .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '') // Strip non-printable ASCII except newlines
          .replace(/ +/g, ' ')           // Collapse multiple spaces
          .trim();
          
        // Filter out empty lines
        rawText = rawText.split('\n')
                         .map((l: string) => l.trim())
                         .filter((l: string) => l.length > 0)
                         .join('\n');
                         
        if (rawText.length < 50) {
           throw new Error('Extracted text is too short. PDF may be a scanned image without text layers.');
        }

        // Dynamic heuristic confidence scoring based on text density and length
        confidence = Math.min(0.98, 0.75 + (rawText.length / 20000));

      } catch (err: any) {
        throw new Error(`Failed to parse PDF document: ${err.message}`);
      }
    } else if (mimeType.startsWith('image/')) {
      // For images, in a real enterprise app we would use Tesseract or Gemini Vision
      // Here we simulate the OCR result for the demo if it's an image
      rawText = "SIMULATED OCR RESULT:\nHEMOGLOBIN: 15.2 g/dL\nEPO: 4.1 mU/mL\nHCT: 45.2%";
      confidence = 0.65;
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    const biomarkers = BiomarkerExtractionService.extract(rawText);

    return {
      rawText,
      biomarkers,
      confidence
    };
  }
}
