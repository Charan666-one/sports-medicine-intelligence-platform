import { describe, it, expect } from 'vitest';
import { NormalizationService } from '../src/services/normalization.service.js';

describe('NormalizationService', () => {
  it('maps marker aliases to canonical names', () => {
    expect(NormalizationService.normalize('Hb', '15.2', 'g/dL')?.parameter).toBe('Hemoglobin');
    expect(NormalizationService.normalize('HCT', '45', '%')?.parameter).toBe('Hematocrit');
    expect(NormalizationService.normalize('erythropoietin', '5', 'mU/mL')?.parameter).toBe('EPO');
  });

  it('converts g/L hemoglobin to g/dL', () => {
    const n = NormalizationService.normalize('Hemoglobin', '152', 'g/L');
    expect(n?.value).toBe(15.2);
    expect(n?.unit).toBe('g/dL');
  });

  it('parses comma decimals', () => {
    expect(NormalizationService.normalize('Hemoglobin', '15,2', 'g/dL')?.value).toBe(15.2);
  });

  it('returns null for non-numeric values', () => {
    expect(NormalizationService.normalize('Hb', 'N/A', 'g/dL')).toBeNull();
  });
});
