import { NormalizedBiomarker } from './normalization.service.js';
import { DataQualityFinding } from '../types/dataQuality.js';

export interface ValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID' | 'INCOMPLETE';
  notes: string[];
  qualityScore: number;
  /** Categorized findings (Phase 4) — see src/types/dataQuality.ts. */
  findings: DataQualityFinding[];
}

/** Below this extraction confidence, an out-of-range reading is presumed a mis-scan, not real. */
const LOW_CONFIDENCE_THRESHOLD = 0.5;

export class ReportValidationService {
  /**
   * Validates extracted biomarkers against physiological ranges and
   * classifies problems as likely extraction/data errors vs genuinely
   * atypical (but plausible) physiology.
   *
   * @param ocrConfidence Extraction confidence (0..1) from the document
   *   parser. Low confidence lowers the bar for treating an implausible
   *   value as a DATA_ERROR (mis-scan) rather than a real anomaly.
   */
  static validate(biomarkers: NormalizedBiomarker[], ocrConfidence = 1): ValidationResult {
    const notes: string[] = [];
    const findings: DataQualityFinding[] = [];
    let qualityScore = 1.0;
    const lowConfidence = ocrConfidence < LOW_CONFIDENCE_THRESHOLD;

    const flagDataError = (parameter: string, message: string, penalty: number) => {
      notes.push(message);
      findings.push({ category: 'DATA_ERROR', parameter, message });
      qualityScore -= penalty;
    };

    const flagPhysiologicalAnomaly = (parameter: string, message: string, penalty: number) => {
      notes.push(message);
      findings.push({ category: 'PHYSIOLOGICAL_ANOMALY', parameter, message });
      qualityScore -= penalty;
    };

    if (biomarkers.length === 0) {
      return {
        isValid: false,
        status: 'INCOMPLETE',
        notes: ['No biomarkers detected in report.'],
        qualityScore: 0,
        findings: [{ category: 'DATA_ERROR', parameter: 'document', message: 'No biomarkers detected in report.' }],
      };
    }

    // Missing core markers is an extraction gap, not a physiological finding.
    const coreMarkers = ['Hemoglobin', 'EPO'];
    coreMarkers.forEach((m) => {
      if (!biomarkers.find((b) => b.parameter === m)) {
        flagDataError(m, `Missing core biomarker: ${m}`, 0.2);
      }
    });

    // Bounds check. A value outside physiological possibility is either a
    // real medical emergency (vanishingly unlikely for a monitored athlete)
    // or, far more likely, an extraction mistake — especially when OCR/parse
    // confidence was already low. Values inside human range but still
    // extreme are flagged as PHYSIOLOGICAL_ANOMALY, not a data error.
    biomarkers.forEach((b) => {
      if (b.parameter === 'Hemoglobin' && (b.value < 5 || b.value > 25)) {
        const note = `Physiologically impossible Hemoglobin value: ${b.value}${lowConfidence ? ' (low extraction confidence — likely a mis-scan)' : ''}`;
        flagDataError('Hemoglobin', note, 0.5);
      }
      if (b.parameter === 'Hematocrit' && (b.value < 15 || b.value > 75)) {
        const note = `Physiologically impossible Hematocrit value: ${b.value}${lowConfidence ? ' (low extraction confidence — likely a mis-scan)' : ''}`;
        flagDataError('Hematocrit', note, 0.3);
      }
      if (b.parameter === 'EPO' && (b.value < 0 || b.value > 100)) {
        flagDataError('EPO', `Invalid EPO value: ${b.value}`, 0.3);
      }
      if (b.parameter === 'Ferritin' && (b.value < 1 || b.value > 5000)) {
        const note = `Highly suspicious Ferritin value: ${b.value}`;
        if (lowConfidence) {
          flagDataError('Ferritin', `${note} (low extraction confidence — likely a mis-scan)`, 0.2);
        } else {
          flagPhysiologicalAnomaly('Ferritin', note, 0.2);
        }
      }
    });

    const isValid = qualityScore > 0.4;
    const status = isValid ? (qualityScore > 0.8 ? 'VALID' : 'INCOMPLETE') : 'INVALID';

    return {
      isValid,
      status,
      notes,
      qualityScore: Math.max(qualityScore, 0),
      findings,
    };
  }
}
