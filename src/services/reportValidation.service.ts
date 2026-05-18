import { NormalizedBiomarker } from './normalization.service.js';

export interface ValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID' | 'INCOMPLETE';
  notes: string[];
  qualityScore: number;
}

export class ReportValidationService {
  /**
   * Validates extracted biomarkers against physiological ranges
   */
  static validate(biomarkers: NormalizedBiomarker[]): ValidationResult {
    const notes: string[] = [];
    let qualityScore = 1.0;

    if (biomarkers.length === 0) {
      return {
        isValid: false,
        status: 'INCOMPLETE',
        notes: ['No biomarkers detected in report.'],
        qualityScore: 0
      };
    }

    // Check for core markers
    const coreMarkers = ['Hemoglobin', 'EPO'];
    coreMarkers.forEach(m => {
      if (!biomarkers.find(b => b.parameter === m)) {
        notes.push(`Missing core biomarker: ${m}`);
        qualityScore -= 0.2;
      }
    });

    // impossible value check
    biomarkers.forEach(b => {
      if (b.parameter === 'Hemoglobin' && (b.value < 5 || b.value > 25)) {
        notes.push(`Physiologically impossible Hemoglobin value: ${b.value}`);
        qualityScore -= 0.5;
      }
      if (b.parameter === 'Hematocrit' && (b.value < 15 || b.value > 75)) {
        notes.push(`Physiologically impossible Hematocrit value: ${b.value}`);
        qualityScore -= 0.3;
      }
      if (b.parameter === 'EPO' && (b.value < 0 || b.value > 100)) {
        notes.push(`Invalid EPO value: ${b.value}`);
        qualityScore -= 0.3;
      }
      if (b.parameter === 'Ferritin' && (b.value < 1 || b.value > 5000)) {
        notes.push(`Highly suspicious Ferritin value: ${b.value}`);
        qualityScore -= 0.2;
      }
    });

    const isValid = qualityScore > 0.4;
    const status = isValid ? (qualityScore > 0.8 ? 'VALID' : 'INCOMPLETE') : 'INVALID';

    return {
      isValid,
      status,
      notes,
      qualityScore: Math.max(qualityScore, 0)
    };
  }
}
