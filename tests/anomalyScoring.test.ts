import { describe, it, expect } from 'vitest';
import { evaluateAnomalySignals, computeStabilityIndex } from '../src/services/anomalyScoring.js';

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

describe('computeStabilityIndex', () => {
  it('scores a consistent personal history as highly stable', () => {
    const history = [baseline(14.9), baseline(15.0), baseline(14.8), baseline(15.1), baseline(14.95)];
    expect(computeStabilityIndex(history)).toBeGreaterThan(80);
  });

  it('scores a volatile personal history as unstable', () => {
    // All five markers swing together — a "stable" test would only vary
    // hemoglobin, leaving the other four markers' zero variance dragging
    // the mean CV down; this exercises genuine multi-marker volatility.
    const history = [
      { hemoglobin: 12.0, hematocrit: 35, testosteroneRatio: 0.5, reticulocyte: 0.5, epo: 2 },
      { hemoglobin: 18.5, hematocrit: 56, testosteroneRatio: 3.5, reticulocyte: 3.5, epo: 15 },
      { hemoglobin: 13.5, hematocrit: 38, testosteroneRatio: 0.8, reticulocyte: 0.8, epo: 3 },
      { hemoglobin: 19.0, hematocrit: 58, testosteroneRatio: 3.8, reticulocyte: 3.8, epo: 16 },
      { hemoglobin: 11.8, hematocrit: 34, testosteroneRatio: 0.4, reticulocyte: 0.4, epo: 2 },
    ];
    expect(computeStabilityIndex(history)).toBeLessThan(50);
  });

  it('returns the neutral midpoint (not a falsely-confident default) with insufficient history', () => {
    expect(computeStabilityIndex([])).toBe(50);
    expect(computeStabilityIndex([baseline(15), baseline(15.1)])).toBe(50);
  });

  it('varies per athlete instead of being a flat constant (regression guard for the mock-data fix)', () => {
    const stable = computeStabilityIndex([baseline(14.9), baseline(15.0), baseline(14.8), baseline(15.1)]);
    const volatile = computeStabilityIndex([
      { hemoglobin: 12.0, hematocrit: 35, testosteroneRatio: 0.5, reticulocyte: 0.5, epo: 2 },
      { hemoglobin: 18.5, hematocrit: 56, testosteroneRatio: 3.5, reticulocyte: 3.5, epo: 15 },
      { hemoglobin: 13.5, hematocrit: 38, testosteroneRatio: 0.8, reticulocyte: 0.8, epo: 3 },
    ]);
    expect(stable).not.toBe(volatile);
    expect(stable).toBeGreaterThan(volatile);
  });
});
