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
});
