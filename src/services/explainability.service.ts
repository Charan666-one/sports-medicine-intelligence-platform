import { FeatureImpactService, FeatureImpact } from './featureImpact.service.js';
import { ConfidenceAnalysisService, ConfidenceResult } from './confidenceAnalysis.service.js';
import { MedicalReasoningService, ExtendedReasoning } from './medicalReasoning.service.js';
import { GeminiEnhancementService } from './geminiEnhancement.service.js';

export interface XAIReport {
  impacts: FeatureImpact[];
  confidence: ConfidenceResult;
  reasoning: ExtendedReasoning;
  aiEnhancedSummary?: string;
}

export class ExplainabilityService {
  /**
   * Generates a complete XAI report for a prediction
   */
  static generateReport(
    latestBiomarkers: Record<string, number>,
    historicalBiomarkers: Record<string, number>[],
    riskLevel: string,
    riskProbs: Record<string, number>,
    anomalyScore: number,
    isAnomaly: boolean
  ): XAIReport {
    // 1. Calculate Feature Impact
    const impacts = FeatureImpactService.calculateImpact(latestBiomarkers, historicalBiomarkers);

    // 2. Analyze Confidence
    const confidence = ConfidenceAnalysisService.analyze(
      historicalBiomarkers.length,
      anomalyScore,
      riskProbs,
      isAnomaly
    );

    // 3. Generate Deterministic Reasoning (Phase 6 Core)
    const reasoning = MedicalReasoningService.generateDeterministicReasoning(
      riskLevel,
      impacts,
      anomalyScore,
      confidence.stabilityScore,
      "Athlete"
    );

    return {
      impacts,
      confidence,
      reasoning
    };
  }

  /**
   * Optional LLM Enhancement 
   */
  static async enhanceReportWithAI(report: XAIReport): Promise<XAIReport> {
    const enhanced = await GeminiEnhancementService.enhanceSummary(
      report.reasoning.summary,
      report.reasoning.findings
    );
    return {
      ...report,
      aiEnhancedSummary: enhanced
    };
  }
}
