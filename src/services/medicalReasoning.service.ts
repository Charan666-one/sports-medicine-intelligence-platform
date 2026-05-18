import { FeatureImpact } from './featureImpact.service.js';

export interface ExtendedReasoning {
  summary: string;
  findings: string[];
  longitudinalInsight: string;
  analystNarrative: string;
  riskJustification: string;
}

export class MedicalReasoningService {
  /**
   * Generates deterministic natural language medical reasoning 
   * based on ML scores, biomarker impacts, and stability indices.
   */
  static generateDeterministicReasoning(
    riskLevel: string,
    impacts: FeatureImpact[],
    anomalyScore: number,
    stabilityIndex: number,
    athleteName: string
  ): ExtendedReasoning {
    const findings: string[] = [];
    const significantImpacts = impacts.filter(i => i.percentage > 10);
    
    // 1. Core Summary
    let summary = `Athlete ${athleteName} matches a ${riskLevel} risk profile. `;
    if (anomalyScore > 0.7) {
      summary += "A significant physiological outlier was detected using Isolation Forest modeling. ";
    }

    // 2. Finding Generation
    significantImpacts.slice(0, 4).forEach(impact => {
      const bio = impact.name.toUpperCase();
      const deviation = impact.zScore.toFixed(2);
      if (Math.abs(impact.zScore) > 2.0) {
        findings.push(`Critical ${bio} variance detected at ${deviation}σ deviation, suggesting acute physiological shift.`);
      } else if (Math.abs(impact.zScore) > 1.0) {
        findings.push(`${bio} shows moderate deviation (${deviation}σ), contributing to the current risk classification.`);
      }
    });

    // 3. Risk Justification
    let riskJustification = "";
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      riskJustification = `Risk is elevated primarily due to ${significantImpacts[0]?.name || 'multiple biomarker'} instabilities. Historical comparison indicates this pattern is atypical for this athlete.`;
    } else {
      riskJustification = "Biomarker data remains within expanded biological passport expectations despite minor fluctuations.";
    }

    // 4. Analyst-Friendly Narrative
    const analystNarrative = `Longitudinal stability is currently ${ (stabilityIndex * 100).toFixed(1) }%. The primary driver was ${significantImpacts[0]?.name || 'balanced variance'}. High-confidence identification of ${riskLevel.toLowerCase()} risk state.`;

    // 5. Longitudinal Insights
    let longitudinalInsight = stabilityIndex < 0.6 
      ? "Significant longitudinal suppression. Pattern inconsistent with documented baseline."
      : "Baseline consistency maintained. Oscillations are within standard cyclical range.";

    return {
      summary,
      findings,
      longitudinalInsight,
      analystNarrative,
      riskJustification
    };
  }
}
