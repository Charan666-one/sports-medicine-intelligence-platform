import * as ss from 'simple-statistics';

/**
 * Pure biomarker anomaly scoring (no DB / model deps, so it is unit-testable).
 *
 * Combines two deterministic signals:
 *   (a) Personal-baseline z-score — deviation of the latest reading from the
 *       athlete's own prior history (needs >= 3 prior points).
 *   (b) Population red flags — a single sample above clinical limits, atypical
 *       on its own even with no history.
 * The Isolation Forest (multivariate) signal is blended in by the caller.
 */

export const ANOMALY_MARKERS = [
  'hemoglobin',
  'hematocrit',
  'testosteroneRatio',
  'reticulocyte',
  'epo',
] as const;

/** Population-level upper limits (blood-passport style single-sample flags). */
export const POP_LIMITS: Record<string, number> = {
  hemoglobin: 18.0, // g/dL
  hematocrit: 54.0, // %
  testosteroneRatio: 4.0, // T/E
  epo: 12.0, // mU/mL
  reticulocyte: 2.4, // %
};

export type MarkerPoint = Record<string, number>;

export interface AnomalySignals {
  statScore: number; // 0..1 from personal-baseline z-score
  popScore: number; // 0..1 from population red flags
  maxZ: number; // largest personal-baseline deviation (σ)
  drivers: string[]; // human-readable reasons
  isFlagged: boolean; // true if z-score or population signal alone is anomalous
}

export function evaluateAnomalySignals(latest: MarkerPoint, history: MarkerPoint[]): AnomalySignals {
  const drivers: string[] = [];
  const hist = (history || []).filter(Boolean);

  // (a) Personal-baseline z-scores.
  let maxZ = 0;
  if (hist.length >= 3) {
    for (const m of ANOMALY_MARKERS) {
      const vals = hist.map((h) => h[m]).filter((v) => typeof v === 'number' && v > 0);
      if (vals.length < 3) continue;
      const mean = ss.mean(vals);
      const std = Math.max(ss.standardDeviation(vals), 0.1); // floor avoids divide-by-tiny
      const cur = latest[m];
      if (!cur) continue;
      const z = Math.abs((cur - mean) / std);
      if (z > maxZ) maxZ = z;
      if (z >= 3) drivers.push(`${m} deviates ${z.toFixed(1)}σ from personal baseline`);
    }
  }
  const statScore = Math.min(1, maxZ / 6);

  // (b) Population-level single-sample red flags.
  let popScore = 0;
  for (const [m, limit] of Object.entries(POP_LIMITS)) {
    const cur = latest[m];
    if (!cur) continue;
    if (cur > limit) {
      const over = (cur - limit) / limit;
      popScore = Math.max(popScore, Math.min(1, 0.6 + over));
      drivers.push(`${m} (${cur}) exceeds population limit ${limit}`);
    }
  }

  return { statScore, popScore, maxZ, drivers, isFlagged: maxZ >= 3 || popScore >= 0.6 };
}

/** Below this, a marker's coefficient of variation is treated as "unstable" (100 -> down toward 0). */
const CV_UNSTABLE_CEILING = 0.25;

/**
 * Longitudinal physiological stability (Phase 6 baseline signal), 0-100:
 * how consistent an athlete's own core biomarkers have been across their
 * available report history, via mean coefficient-of-variation (stdDev /
 * mean) across ANOMALY_MARKERS — low CV (tight, consistent readings) scores
 * high; volatile report-to-report swings score low.
 *
 * Needs >= 3 prior points per marker to be meaningful (same floor as the
 * personal-baseline z-score above); returns the neutral midpoint (50) when
 * there isn't enough history yet, rather than a false, over-confident
 * default — this feeds the anomaly-detection feature vector, where an
 * athlete's very first few reports must not be silently treated as
 * maximally "stable."
 */
export function computeStabilityIndex(history: MarkerPoint[]): number {
  const hist = (history || []).filter(Boolean);
  const cvs: number[] = [];

  for (const m of ANOMALY_MARKERS) {
    const vals = hist.map((h) => h[m]).filter((v) => typeof v === 'number' && v > 0);
    if (vals.length < 3) continue;
    const mean = ss.mean(vals);
    if (mean <= 0) continue;
    const cv = ss.standardDeviation(vals) / mean;
    cvs.push(cv);
  }

  if (cvs.length === 0) return 50; // insufficient history — neutral, not falsely confident

  const meanCv = ss.mean(cvs);
  const stability = 100 * Math.max(0, 1 - meanCv / CV_UNSTABLE_CEILING);
  return Number(stability.toFixed(1));
}
