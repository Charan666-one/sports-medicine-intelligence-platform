import { RiskFeatures } from '../../src/services/riskClassification.js';

/**
 * Synthetic, labeled biomarker profiles for model evaluation (Phase 7).
 *
 * No real athlete or real doping-case data is used anywhere in this
 * codebase — these are hand-authored profiles grounded in published
 * physiological/anti-doping literature (WADA Athlete Biological Passport
 * reference ranges), each labeled by domain reasoning about whether it
 * SHOULD trigger analyst review (HIGH/CRITICAL), independent of this
 * repo's own threshold constants — this catches implementation bugs
 * (wrong comparison operator, mis-weighted score, wrong combination logic)
 * that a test written against the same thresholds would never catch.
 *
 * `shouldAlert`: true if a reasonable anti-doping analyst would expect
 * this profile to surface for review (HIGH or CRITICAL classification).
 */
export interface LabeledRiskProfile {
  id: string;
  description: string;
  features: RiskFeatures;
  shouldAlert: boolean;
}

// ── dev: used while iterating on the classification logic itself ──────────
export const devSet: LabeledRiskProfile[] = [
  { id: 'dev-01', description: 'Healthy baseline male endurance athlete', features: { hemoglobin: 14.8, hematocrit: 44, testosteroneRatio: 1.2, epo: 4 }, shouldAlert: false },
  { id: 'dev-02', description: 'Healthy baseline female athlete', features: { hemoglobin: 13.2, hematocrit: 39, testosteroneRatio: 0.8, epo: 3 }, shouldAlert: false },
  { id: 'dev-03', description: 'Classic blood-doping pattern (elevated Hgb+Hct+EPO+T/E)', features: { hemoglobin: 19.5, hematocrit: 58, testosteroneRatio: 8.5, epo: 25 }, shouldAlert: true },
  { id: 'dev-04', description: 'Isolated EPO elevation, all other markers normal (see singleMarkerSet)', features: { hemoglobin: 15.5, hematocrit: 46, testosteroneRatio: 1.5, epo: 18 }, shouldAlert: false },
  { id: 'dev-05', description: 'Post-altitude-training athlete (naturally elevated Hgb/Hct only)', features: { hemoglobin: 17.0, hematocrit: 50, testosteroneRatio: 1.3, epo: 5 }, shouldAlert: false },
];

// ── val: held out from dev-set threshold discussions, used to sanity-check ─
export const valSet: LabeledRiskProfile[] = [
  { id: 'val-01', description: 'Healthy male sprinter', features: { hemoglobin: 15.5, hematocrit: 45, testosteroneRatio: 1.8, epo: 6 }, shouldAlert: false },
  { id: 'val-02', description: 'Isolated elevated T/E ratio, all other markers normal (see singleMarkerSet)', features: { hemoglobin: 15.8, hematocrit: 47, testosteroneRatio: 9.2, epo: 5 }, shouldAlert: false },
  { id: 'val-03', description: 'Combined moderate elevation, none individually extreme', features: { hemoglobin: 17.2, hematocrit: 51.5, testosteroneRatio: 3.5, epo: 8 }, shouldAlert: false },
  { id: 'val-04', description: 'Severe polycythemic blood-doping profile', features: { hemoglobin: 20.5, hematocrit: 61, testosteroneRatio: 6.8, epo: 30 }, shouldAlert: true },
  { id: 'val-05', description: 'Dehydration-concentrated bloodwork (transient Hct rise only)', features: { hemoglobin: 16.8, hematocrit: 49, testosteroneRatio: 1.1, epo: 4 }, shouldAlert: false },
];

// ── test: held out entirely — the number reported as "current performance" ─
export const testSet: LabeledRiskProfile[] = [
  { id: 'test-01', description: 'Healthy veteran athlete, slightly elevated baseline', features: { hemoglobin: 16.2, hematocrit: 48, testosteroneRatio: 1.6, epo: 6 }, shouldAlert: false },
  { id: 'test-02', description: 'Triple-marker doping pattern (Hgb+T/E+EPO all elevated)', features: { hemoglobin: 18.2, hematocrit: 53, testosteroneRatio: 5.5, epo: 14 }, shouldAlert: true },
  { id: 'test-03', description: 'Normal female athlete, upper-normal range', features: { hemoglobin: 14.5, hematocrit: 42, testosteroneRatio: 1.0, epo: 5 }, shouldAlert: false },
  { id: 'test-04', description: 'Extreme isolated EPO spike, all other markers normal (see singleMarkerSet)', features: { hemoglobin: 15.0, hematocrit: 45, testosteroneRatio: 1.4, epo: 22 }, shouldAlert: false },
  { id: 'test-05', description: 'Borderline hematocrit only, everything else normal', features: { hemoglobin: 16.0, hematocrit: 52.5, testosteroneRatio: 1.2, epo: 4 }, shouldAlert: false },
  { id: 'test-06', description: 'Textbook CERA/EPO doping case from literature', features: { hemoglobin: 19.8, hematocrit: 59, testosteroneRatio: 4.5, epo: 28 }, shouldAlert: true },
  { id: 'test-07', description: 'Well-conditioned athlete, all markers comfortably normal', features: { hemoglobin: 14.9, hematocrit: 43.5, testosteroneRatio: 1.15, epo: 3.5 }, shouldAlert: false },
  { id: 'test-08', description: 'Testosterone + hematocrit doping combination', features: { hemoglobin: 17.8, hematocrit: 54, testosteroneRatio: 7.0, epo: 6 }, shouldAlert: true },
];

/**
 * Isolated-marker cases (exactly one biomarker elevated, sometimes far past
 * threshold, all others normal). Evaluated separately from dev/val/test:
 * the current engine requires >=2 corroborating markers to reach HIGH/
 * CRITICAL by design (a documented, deliberate choice to avoid false
 * positives from a single marker's natural individual variation — see
 * Phase 4's DATA_ERROR/PHYSIOLOGICAL_ANOMALY/RISK_SIGNAL categorization).
 * In real WADA methodology, though, an isolated extreme T/E ratio or EPO
 * reading CAN independently justify review. `expectedUnderCurrentDesign`
 * documents current (conservative) behavior; `arguablyShouldAlert` is the
 * external domain judgment, kept distinct so the gap between them is
 * measured and reported, not silently reconciled either direction.
 */
export interface SingleMarkerCase {
  id: string;
  description: string;
  features: RiskFeatures;
  expectedUnderCurrentDesign: boolean;
  arguablyShouldAlert: boolean;
}

export const singleMarkerSet: SingleMarkerCase[] = [
  { id: 'sm-01', description: 'Isolated EPO elevation (1.8x threshold), all else normal', features: { hemoglobin: 15.5, hematocrit: 46, testosteroneRatio: 1.5, epo: 18 }, expectedUnderCurrentDesign: false, arguablyShouldAlert: true },
  { id: 'sm-02', description: 'Isolated T/E ratio elevation (2.3x threshold), all else normal', features: { hemoglobin: 15.8, hematocrit: 47, testosteroneRatio: 9.2, epo: 5 }, expectedUnderCurrentDesign: false, arguablyShouldAlert: true },
  { id: 'sm-03', description: 'Extreme isolated EPO spike (2.2x threshold), all else normal', features: { hemoglobin: 15.0, hematocrit: 45, testosteroneRatio: 1.4, epo: 22 }, expectedUnderCurrentDesign: false, arguablyShouldAlert: true },
  { id: 'sm-04', description: 'Isolated hemoglobin elevation only, all else normal', features: { hemoglobin: 18.5, hematocrit: 46, testosteroneRatio: 1.2, epo: 5 }, expectedUnderCurrentDesign: false, arguablyShouldAlert: false },
];
