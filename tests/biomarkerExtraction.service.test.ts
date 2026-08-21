import { describe, it, expect } from 'vitest';
import { BiomarkerExtractionService } from '../src/services/biomarkerExtraction.service.js';

describe('BiomarkerExtractionService', () => {
  it('extracts biomarkers from free-text lab report lines', () => {
    const text = ['Hemoglobin: 18.1 g/dL', 'Hematocrit: 52.4 %', 'EPO 9.1 mU/mL', 'Reticulocytes: 2.4 %'].join(
      '\n',
    );
    const names = BiomarkerExtractionService.extract(text).map((b) => b.parameter);
    expect(names).toContain('Hemoglobin');
    expect(names).toContain('Hematocrit');
    expect(names).toContain('EPO');
    expect(names).toContain('Reticulocytes');
  });

  it('deduplicates repeated markers', () => {
    const text = 'Hemoglobin: 15 g/dL\nHemoglobin: 16 g/dL';
    const hb = BiomarkerExtractionService.extract(text).filter((b) => b.parameter === 'Hemoglobin');
    expect(hb).toHaveLength(1);
  });

  it('returns an empty array when no markers are present', () => {
    expect(BiomarkerExtractionService.extract('no clinical values here')).toHaveLength(0);
  });
});
