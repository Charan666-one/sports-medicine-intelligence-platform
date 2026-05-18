import { FeatureImpact } from './featureImpact.service.js';

export interface MedicalReasoning {
  summary: string;
  findings: string[];
  longitudinalInsight: string;
}

export class ReasoningEngineService {
  /**
   * Generates natural language medical reasoning from technical ML outputs
   */
  static generateReasoning(
    riskLevel: string,
    impacts: FeatureImpact[],
    isAnomaly: boolean,
    stabilityIndex: number
  ): MedicalReasoning {
    const findings: string[] = [];
    const topImpacts = impacts.filter(i => i.percentage > 15);
    
    // 1. Summary Generation
    let summary = `Athlete profile analyzed as ${riskLevel} risk. `;
    if (isAnomaly) {
      summary += "Non-standard physiological signature detected via Isolation Forest.";
    } else {
      summary += "Physiological patterns conform to expected population clusters.";
    }

    // 2. Findings Generation
    topImpacts.forEach(impact => {
      const bioName = impact.name.toUpperCase();
      if (impact.direction === 'UP') {
        findings.push(`${bioName} transition indicates relative upward trend (+${impact.zScore.toFixed(1)}σ deviation).`);
      } else if (impact.direction === 'DOWN') {
        findings.push(`${bioName} suppression detected (-${Math.abs(impact.zScore).toFixed(1)}σ deviation).`);
      } else {
        findings.push(`${bioName} variance contributing to pattern recognition.`);
      }
    });

    // 3. Longitudinal Insights
    let longitudinalInsight = "";
    if (stabilityIndex < 0.5) {
      longitudinalInsight = "Low longitudinal consistency. Biomarker variance suggests physiological instability over 90-day window.";
    } else {
      longitudinalInsight = "High physiological stability maintained relative to athlete baseline.";
    }

    return {
      summary,
      findings,
      longitudinalInsight
    };
  }
}
