import { describe, it, expect } from 'vitest';
import { ReportValidationService } from '../src/services/reportValidation.service.js';

describe('ReportValidationService', () => {
  it('accepts a physiologically-plausible panel', () => {
    const result = ReportValidationService.validate([
      { parameter: 'Hemoglobin', value: 15, unit: 'g/dL' },
      { parameter: 'EPO', value: 5, unit: 'mU/mL' },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('VALID');
  });

  it('flags a physiologically-impossible hemoglobin value', () => {
    const result = ReportValidationService.validate([
      { parameter: 'Hemoglobin', value: 99, unit: 'g/dL' },
      { parameter: 'EPO', value: 5, unit: 'mU/mL' },
    ]);
    expect(result.notes.join(' ')).toMatch(/impossible Hemoglobin/i);
    expect(result.qualityScore).toBeLessThan(1);
  });

  it('reports an empty extraction as incomplete', () => {
    const result = ReportValidationService.validate([]);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('INCOMPLETE');
  });

  describe('data-quality categorization (Phase 4)', () => {
    it('categorizes a physiologically-impossible value as DATA_ERROR regardless of confidence', () => {
      const result = ReportValidationService.validate(
        [{ parameter: 'Hemoglobin', value: 99, unit: 'g/dL' }],
        0.95, // high extraction confidence — still impossible for a human
      );
      const finding = result.findings.find((f) => f.parameter === 'Hemoglobin');
      expect(finding?.category).toBe('DATA_ERROR');
    });

    it('notes low extraction confidence as the likely cause of an impossible value', () => {
      const result = ReportValidationService.validate(
        [{ parameter: 'Hemoglobin', value: 99, unit: 'g/dL' }],
        0.2,
      );
      const finding = result.findings.find((f) => f.parameter === 'Hemoglobin');
      expect(finding?.message).toMatch(/low extraction confidence/i);
    });

    it('categorizes an unusual-but-plausible value as PHYSIOLOGICAL_ANOMALY at high confidence', () => {
      const result = ReportValidationService.validate(
        [
          { parameter: 'Hemoglobin', value: 15, unit: 'g/dL' },
          { parameter: 'EPO', value: 5, unit: 'mU/mL' },
          { parameter: 'Ferritin', value: 5500, unit: 'ng/mL' },
        ],
        0.95,
      );
      const finding = result.findings.find((f) => f.parameter === 'Ferritin');
      expect(finding?.category).toBe('PHYSIOLOGICAL_ANOMALY');
    });

    it('downgrades the same unusual Ferritin value to DATA_ERROR at low confidence', () => {
      const result = ReportValidationService.validate(
        [
          { parameter: 'Hemoglobin', value: 15, unit: 'g/dL' },
          { parameter: 'EPO', value: 5, unit: 'mU/mL' },
          { parameter: 'Ferritin', value: 5500, unit: 'ng/mL' },
        ],
        0.3,
      );
      const finding = result.findings.find((f) => f.parameter === 'Ferritin');
      expect(finding?.category).toBe('DATA_ERROR');
    });

    it('flags a missing core biomarker as DATA_ERROR (extraction gap, not physiology)', () => {
      const result = ReportValidationService.validate([{ parameter: 'Hemoglobin', value: 15, unit: 'g/dL' }]);
      const finding = result.findings.find((f) => f.parameter === 'EPO');
      expect(finding?.category).toBe('DATA_ERROR');
    });

    it('produces no findings for a clean, plausible panel', () => {
      const result = ReportValidationService.validate([
        { parameter: 'Hemoglobin', value: 15, unit: 'g/dL' },
        { parameter: 'EPO', value: 5, unit: 'mU/mL' },
      ]);
      expect(result.findings).toEqual([]);
    });
  });
});
