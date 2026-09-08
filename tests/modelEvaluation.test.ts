import { describe, it, expect } from 'vitest';
import { calculateRiskClass } from '../src/services/riskClassification.js';
import { evaluateAnomalySignals } from '../src/services/anomalyScoring.js';
import { evaluateBinaryClassification, ClassificationMetrics } from '../src/utils/evaluationMetrics.js';
import { devSet, valSet, testSet, singleMarkerSet, LabeledRiskProfile } from './fixtures/syntheticRiskProfiles.js';

/**
 * Model evaluation (Phase 7): quantifies how well the deterministic risk
 * engine's classifications match domain-grounded expectations, using
 * synthetic labeled data with a dev/val/test split. This is a regression
 * guard against the classification LOGIC breaking (wrong operator,
 * mis-weighted score) — it does not and cannot validate that the
 * thresholds themselves are clinically optimal; that is a domain/policy
 * decision outside this codebase's scope.
 */

function runSplit(profiles: LabeledRiskProfile[]): ClassificationMetrics {
  const predicted = profiles.map((p) => {
    const { level } = calculateRiskClass(p.features);
    return level === 'HIGH' || level === 'CRITICAL';
  });
  const actual = profiles.map((p) => p.shouldAlert);
  return evaluateBinaryClassification(predicted, actual);
}

describe('Model evaluation: risk classification (calculateRiskClass)', () => {
  it('dev set — sanity check while iterating', () => {
    const metrics = runSplit(devSet);
    console.log('[model-eval] risk classification — dev:', metrics);
    expect(metrics.f1).toBeGreaterThanOrEqual(0.8);
  });

  it('val set — held out from dev-time iteration', () => {
    const metrics = runSplit(valSet);
    console.log('[model-eval] risk classification — val:', metrics);
    expect(metrics.f1).toBeGreaterThanOrEqual(0.8);
  });

  it('test set — held out entirely; this is the number that goes in ENGINEERING_READINESS.md', () => {
    const metrics = runSplit(testSet);
    console.log('[model-eval] risk classification — test:', metrics);
    // A floor well above chance, not a tuned target: this guards against a
    // real regression (inverted logic, wrong operator) without being so
    // tight that reasonable threshold tweaks turn CI red for no real bug.
    expect(metrics.precision).toBeGreaterThanOrEqual(0.7);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.7);
    expect(metrics.f1).toBeGreaterThanOrEqual(0.7);
  });

  it('documents a known limitation: an isolated extreme single-marker reading does not reach HIGH/CRITICAL by design (requires >=2 corroborating markers)', () => {
    const results = singleMarkerSet.map((c) => {
      const { level, score } = calculateRiskClass(c.features);
      const predicted = level === 'HIGH' || level === 'CRITICAL';
      return { ...c, level, score, predicted };
    });
    console.log('[model-eval] single-marker sensitivity (informational, not a pass/fail gate):', results);

    // Assert the CURRENT documented behavior (regression guard for this
    // specific design choice) — not the external domain judgment, which
    // is a policy question for analysts/maintainers, not this test.
    for (const r of results) {
      expect(r.predicted).toBe(r.expectedUnderCurrentDesign);
    }

    const gapCount = results.filter((r) => r.arguablyShouldAlert && !r.predicted).length;
    if (gapCount > 0) {
      console.warn(
        `[model-eval] ${gapCount}/${results.length} single-marker case(s) that domain reasoning ` +
          `flags as alert-worthy are NOT currently flagged (by design). See tests/fixtures/syntheticRiskProfiles.ts.`,
      );
    }
  });
});

describe('Model evaluation: anomaly detection (evaluateAnomalySignals)', () => {
  // Personal-baseline z-score detection needs history; population red flags
  // work standalone. These cases exercise the population-limit path, which
  // is what a first-ever upload (no prior history) relies on.
  const cases: { id: string; description: string; latest: Record<string, number>; shouldFlag: boolean }[] = [
    { id: 'anom-01', description: 'Normal single reading, no history', latest: { hemoglobin: 14.5, hematocrit: 43, testosteroneRatio: 1.2, reticulocyte: 1.0, epo: 4 }, shouldFlag: false },
    { id: 'anom-02', description: 'Population-limit blood-doping reading, no history', latest: { hemoglobin: 19.8, hematocrit: 58, testosteroneRatio: 8.0, reticulocyte: 3.0, epo: 20 }, shouldFlag: true },
    { id: 'anom-03', description: 'Borderline-under-limit reading, no history', latest: { hemoglobin: 17.9, hematocrit: 53.9, testosteroneRatio: 3.9, reticulocyte: 2.3, epo: 11.9 }, shouldFlag: false },
    { id: 'anom-04', description: 'Single population-limit breach (EPO only), no history', latest: { hemoglobin: 14.5, hematocrit: 43, testosteroneRatio: 1.2, reticulocyte: 1.0, epo: 15 }, shouldFlag: true },
  ];

  it('flags population-level red flags correctly (no prior history needed)', () => {
    const predicted = cases.map((c) => evaluateAnomalySignals(c.latest, []).isFlagged);
    const actual = cases.map((c) => c.shouldFlag);
    const metrics = evaluateBinaryClassification(predicted, actual);
    console.log('[model-eval] anomaly detection — population-limit cases:', metrics);
    expect(metrics.f1).toBeGreaterThanOrEqual(0.8);
  });
});
