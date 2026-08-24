import { describe, it, expect } from 'vitest';
import { evaluateAnomalySignals } from '../src/services/anomalyScoring.js';

const baseline = (hb: number): Record<string, number> => ({
  hemoglobin: hb,
  hematocrit: 44,
  testosteroneRatio: 1.0,
  reticulocyte: 1.0,
  epo: 6,
});

describe('evaluateAnomalySignals', () => {
  it('flags a doping-like spike against a stable personal baseline', () => {
    const history = [baseline(14.6), baseline(14.9), baseline(15.0), baseline(14.7), baseline(15.1)];
    const latest = { ...baseline(18.7), hematocrit: 55.8, epo: 21.4, reticulocyte: 3.1, testosteroneRatio: 6.8 };
    const r = evaluateAnomalySignals(latest, history);
    expect(r.isFlagged).toBe(true);
    expect(r.maxZ).toBeGreaterThan(3);
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('does NOT flag a normal reading within personal baseline', () => {
    const history = [baseline(14.6), baseline(14.9), baseline(15.0), baseline(14.7)];
    const r = evaluateAnomalySignals(baseline(15.1), history);
    expect(r.isFlagged).toBe(false);
    expect(r.maxZ).toBeLessThan(3);
  });

  it('flags extreme values with NO history via population red flags', () => {
    const latest = { hemoglobin: 19.3, hematocrit: 57.4, epo: 23.1, reticulocyte: 3.3, testosteroneRatio: 7.9 };
    const r = evaluateAnomalySignals(latest, []);
    expect(r.isFlagged).toBe(true);
    expect(r.popScore).toBeGreaterThanOrEqual(0.6);
  });

  it('does NOT flag a clean single reading with no history', () => {
    const latest = { hemoglobin: 15.1, hematocrit: 44.6, epo: 6.2, reticulocyte: 1.0, testosteroneRatio: 1.1 };
    const r = evaluateAnomalySignals(latest, []);
    expect(r.isFlagged).toBe(false);
    expect(r.statScore).toBe(0);
    expect(r.popScore).toBe(0);
  });
});
