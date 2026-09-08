/**
 * Pure deterministic risk classification (no DB / model deps, so it is
 * unit-testable and model-evaluatable). Extracted from AIEngineService,
 * mirroring anomalyScoring.ts — see that file for the same rationale.
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RiskProbabilities {
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

export interface RiskFeatures {
  hemoglobin: number;
  hematocrit: number;
  testosteroneRatio: number;
  epo: number;
}

export interface RiskClassification {
  level: RiskLevel;
  probs: RiskProbabilities;
  /** The 0-100 weighted score behind the classification, for debugging/evaluation. */
  score: number;
}

/** Population-level thresholds behind the weighted risk score (physio-thresholds@1.0.0). */
export const RISK_THRESHOLDS = {
  hemoglobin: 17.5,
  testosteroneRatio: 4,
  epo: 10,
  hematocrit: 52,
};

export function calculateRiskClass(f: RiskFeatures): RiskClassification {
  // Weighted logic simulating a Random Forest ensemble
  let score = 0;
  if (f.hemoglobin > RISK_THRESHOLDS.hemoglobin) score += 35;
  if (f.testosteroneRatio > RISK_THRESHOLDS.testosteroneRatio) score += 40;
  if (f.epo > RISK_THRESHOLDS.epo) score += 40;
  if (f.hematocrit > RISK_THRESHOLDS.hematocrit) score += 20;

  let level: RiskLevel = 'LOW';
  let probs: RiskProbabilities = { low: 0.9, moderate: 0.1, high: 0, critical: 0 };

  if (score > 80) {
    level = 'CRITICAL';
    probs = { low: 0.05, moderate: 0.1, high: 0.25, critical: 0.6 };
  } else if (score > 50) {
    level = 'HIGH';
    probs = { low: 0.1, moderate: 0.2, high: 0.5, critical: 0.2 };
  } else if (score > 20) {
    level = 'MODERATE';
    probs = { low: 0.3, moderate: 0.5, high: 0.15, critical: 0.05 };
  }

  return { level, probs, score };
}
