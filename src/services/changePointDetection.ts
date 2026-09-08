import * as ss from 'simple-statistics';

/**
 * Change-point detection (Phase 6: Longitudinal Athlete Intelligence).
 *
 * Existing anomaly detection (anomalyScoring.ts) answers "is the LATEST
 * reading unusual?" This answers a different question: "did this athlete's
 * biomarker trajectory shift to a new regime at some point in their
 * history?" — the same question WADA's Athlete Biological Passport
 * adaptive model asks when flagging a step-change rather than a single
 * outlier. Detecting a sustained shift a few points back (not just the
 * newest sample) is a real gap a single-point anomaly check can't cover:
 * a doping program often produces a step-change that then stabilizes at
 * the new (elevated) level, no longer looking anomalous point-to-point.
 *
 * Method: single-change-point mean-shift detection via exhaustive binary
 * segmentation — for every candidate split of the ordered series into a
 * "before" and "after" segment, compute the mean difference in pooled-
 * standard-error units; the split with the largest such statistic is the
 * most likely change point. This is the simplest standard form of
 * change-point detection (a single-changepoint special case of the same
 * family as PELT/binary segmentation) — deterministic, dependency-free,
 * and easy to reason about and test.
 *
 * Known characteristic: this method cannot distinguish a sharp step-change
 * from a sustained gradual trend — both produce a real difference between
 * an early and late window and will be flagged. That is treated as
 * intentional, not a bug: a steady drift over many reports is itself
 * longitudinal information worth an analyst's attention, not noise to
 * suppress. A true trend-vs-level-shift distinction would need a
 * different method.
 */

export interface ChangePointResult {
  /** Whether a statistically meaningful shift was found. */
  detected: boolean;
  /**
   * Index into `series` where the shift occurs: series[0..index) is the
   * "before" segment, series[index..] is "after". Null if not detected or
   * the series is too short to evaluate.
   */
  index: number | null;
  meanBefore: number | null;
  meanAfter: number | null;
  /** Magnitude of the shift, in pooled-standard-error units (higher = more confident). */
  statistic: number;
}

/** Minimum points required on each side of a candidate split to trust its mean. */
const MIN_SEGMENT_SIZE = 3;
/** Statistic threshold to call a shift "detected" — same scale/intent as the z>=3 anomaly threshold elsewhere. */
const DETECTION_THRESHOLD = 3;

/**
 * `series` must be in chronological order (oldest first). Returns the most
 * likely single change point, or `detected: false` if the series is too
 * short or no split clears the detection threshold.
 */
export function detectChangePoint(series: number[]): ChangePointResult {
  const values = series.filter((v) => typeof v === 'number' && !Number.isNaN(v));

  if (values.length < MIN_SEGMENT_SIZE * 2) {
    return { detected: false, index: null, meanBefore: null, meanAfter: null, statistic: 0 };
  }

  let best: ChangePointResult = { detected: false, index: null, meanBefore: null, meanAfter: null, statistic: 0 };

  for (let i = MIN_SEGMENT_SIZE; i <= values.length - MIN_SEGMENT_SIZE; i++) {
    const before = values.slice(0, i);
    const after = values.slice(i);

    const meanBefore = ss.mean(before);
    const meanAfter = ss.mean(after);

    // Pooled standard error across both segments (Welch-style), floored to
    // avoid a divide-by-near-zero blowing up the statistic on near-constant data.
    const varBefore = before.length > 1 ? ss.variance(before) : 0;
    const varAfter = after.length > 1 ? ss.variance(after) : 0;
    const pooledSe = Math.max(Math.sqrt(varBefore / before.length + varAfter / after.length), 0.05);

    const statistic = Math.abs(meanAfter - meanBefore) / pooledSe;

    if (statistic > best.statistic) {
      best = { detected: statistic >= DETECTION_THRESHOLD, index: i, meanBefore, meanAfter, statistic: Number(statistic.toFixed(2)) };
    }
  }

  return best;
}
