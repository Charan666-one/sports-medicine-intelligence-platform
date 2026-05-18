export interface ConfidenceResult {
  score: number; // 0-1
  label: 'HIGH' | 'MODERATE' | 'LOW' | 'UNRELIABLE';
  uncertainty: number; // 0-1
  stabilityScore: number; // 0-1
}

export class ConfidenceAnalysisService {
  /**
   * Analyzes the reliability of a prediction based on data quality and model variance
   */
  static analyze(
    dataPointsCount: number,
    anomalyScore: number,
    riskProbs: Record<string, number>,
    isAnomaly: boolean
  ): ConfidenceResult {
    let baseConfidence = 0.5;

    // 1. Data density impact
    if (dataPointsCount > 10) baseConfidence += 0.2;
    else if (dataPointsCount > 5) baseConfidence += 0.1;
    else baseConfidence -= 0.2;

    // 2. Anomaly clarity
    // If it's a very clear anomaly or a very clear normal, confidence is higher
    const anomalyClarity = Math.abs(anomalyScore - 0.5) * 0.4;
    baseConfidence += anomalyClarity;

    // 3. Probability Consensus
    // If one choice is dominant, confidence is higher
    const maxProb = Math.max(...Object.values(riskProbs));
    if (maxProb > 0.8) baseConfidence += 0.1;
    else if (maxProb < 0.4) baseConfidence -= 0.1;

    // Clamp
    const score = Math.min(Math.max(baseConfidence, 0.1), 0.98);

    let label: ConfidenceResult['label'] = 'MODERATE';
    if (score > 0.85) label = 'HIGH';
    else if (score < 0.4) label = 'LOW';
    else if (score < 0.25) label = 'UNRELIABLE';

    return {
      score,
      label,
      uncertainty: 1 - score,
      stabilityScore: isAnomaly ? 0.3 : 0.85 // Simplified stability index
    };
  }
}
