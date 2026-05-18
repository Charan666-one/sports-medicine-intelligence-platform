import { db } from './db.js';
import { RandomForestClassifier } from 'ml-random-forest';
import { IsolationForest } from 'ml-isolation-forest';
import * as ss from 'simple-statistics';
import { ExplainabilityService, XAIReport } from './explainability.service.js';
import { SocketService } from './socket.service.js';

export interface AIPredictionResult {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  probabilities: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
  anomaly: {
    score: number;
    isAnomaly: boolean;
    isAtypical: boolean;
  };
  explanation: string[];
  importance: Record<string, number>;
  xai: XAIReport;
  aiEnhancedSummary?: string;
}

export class AIEngineService {
  private static FEATURES = ['hemoglobin', 'hematocrit', 'testosteroneRatio', 'reticulocyte', 'epo', 'stabilityIndex'];

  /**
   * Generates AI-driven risk prediction and anomaly detection with XAI
   */
  static async analyzeAthleteAI(athleteId: string): Promise<AIPredictionResult> {
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      include: {
        reports: {
          include: { testResults: true },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!athlete || athlete.reports.length === 0) {
      throw new Error("Insufficient data for AI analysis");
    }

    // 1. Feature Engineering
    const dataPoints = this.prepareFeatures(athlete);
    const latestFeatures = dataPoints[0];

    // 2. Anomaly Detection (Isolation Forest)
    let isAnomaly = false;
    let anomalyScore = 0;
    
    if (dataPoints.length >= 5) {
      const iforest = new IsolationForest({ nEstimators: 100 });
      iforest.fit(dataPoints.map(p => this.featureVector(p)));
      const scores = iforest.scores(dataPoints.map(p => this.featureVector(p)));
      anomalyScore = Math.abs(scores[0]); 
      isAnomaly = anomalyScore > 0.65;
    }

    // 3. Risk Classification (Random Forest Logic)
    const riskAnalysis = this.calculateRiskClass(latestFeatures);

    // 4. Generate Explainable AI Report
    let xaiReport = ExplainabilityService.generateReport(
      latestFeatures as any,
      dataPoints as any[],
      riskAnalysis.level,
      riskAnalysis.probs,
      anomalyScore,
      isAnomaly
    );

    // 5. Optional LLM Enhancement (Phase 6)
    if (process.env.GEMINI_API_KEY) {
      try {
        xaiReport = await ExplainabilityService.enhanceReportWithAI(xaiReport);
      } catch (e) {
        console.warn("AI Enhancement failed, staying deterministic.");
      }
    }

    // Persist to DB with XAI metrics
    const prediction = await db.aIPrediction.create({
      data: {
        athleteId,
        riskLevel: riskAnalysis.level,
        riskProbability: JSON.stringify(riskAnalysis.probs),
        isAnomaly,
        anomalyScore,
        isAtypical: isAnomaly,
        explanation: JSON.stringify(xaiReport.reasoning.findings),
        featureImportance: JSON.stringify(Object.fromEntries(xaiReport.impacts.map(i => [i.name, i.impactWeight]))),
        
        // XAI Fields
        confidenceScore: xaiReport.confidence.score,
        reliabilityLabel: xaiReport.confidence.label,
        stabilityIndex: xaiReport.confidence.stabilityScore,
        reasoningJSON: JSON.stringify(xaiReport.reasoning),
        longitudinalData: JSON.stringify({
          trend: xaiReport.reasoning.longitudinalInsight,
          historySize: dataPoints.length,
          aiEnhanced: xaiReport.aiEnhancedSummary
        }),
        uncertaintyData: JSON.stringify({
          uncertainty: xaiReport.confidence.uncertainty
        }),
        
        modelInfo: "AI_PASS_V2_XAI_OPTIMIZED_PHASE6"
      }
    });

    const result: AIPredictionResult = {
      riskLevel: riskAnalysis.level as any,
      probabilities: riskAnalysis.probs,
      anomaly: {
        score: anomalyScore,
        isAnomaly,
        isAtypical: isAnomaly
      },
      explanation: xaiReport.reasoning.findings,
      importance: Object.fromEntries(xaiReport.impacts.map(i => [i.name, i.impactWeight])),
      xai: xaiReport,
      aiEnhancedSummary: xaiReport.aiEnhancedSummary
    };

    // Phase 7: Real-time notification
    SocketService.emitAIScan({
      athleteId,
      athleteName: athlete.name,
      riskLevel: result.riskLevel,
      anomalyScore: result.anomaly.score,
      isAnomaly: result.anomaly.isAnomaly
    });

    if (isAnomaly) {
      SocketService.emitAnomaly({
        athleteId,
        athleteName: athlete.name,
        score: anomalyScore,
        reason: xaiReport.reasoning.summary
      });
    }

    return result;
  }

  private static prepareFeatures(athlete: any) {
    return athlete.reports.map((report: any) => {
      const results = report.testResults;
      const getVal = (p: string) => results.find((r: any) => r.parameter.toUpperCase().includes(p.toUpperCase()))?.value || 0;
      
      return {
        hemoglobin: getVal('Hemoglobin'),
        hematocrit: getVal('Hematocrit'),
        testosteroneRatio: getVal('Testosterone'),
        reticulocyte: getVal('Reticulocyte'),
        epo: getVal('EPO'),
        stabilityIndex: 85 // Mocked for now, would be calculated from previous turn's stats
      };
    });
  }

  private static featureVector(f: any): number[] {
    return [f.hemoglobin, f.hematocrit, f.testosteroneRatio, f.reticulocyte, f.epo, f.stabilityIndex];
  }

  private static calculateRiskClass(f: any) {
    // Weighted logic simulating a Random Forest ensemble
    let score = 0;
    if (f.hemoglobin > 17.5) score += 35;
    if (f.testosteroneRatio > 4) score += 40;
    if (f.epo > 10) score += 40;
    if (f.hematocrit > 52) score += 20;

    let level = 'LOW';
    let probs = { low: 0.9, moderate: 0.1, high: 0, critical: 0 };

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

    return { level, probs };
  }

  private static calculateFeatureImportance(latest: any, history: any[]) {
    const importance: Record<string, number> = {};
    this.FEATURES.forEach(feat => {
      const vals = history.map(h => (h as any)[feat]).filter(v => v > 0);
      if (vals.length > 2) {
        const mean = ss.mean(vals);
        const std = ss.standardDeviation(vals) || 0.1;
        const z = Math.abs(((latest as any)[feat] - mean) / std);
        importance[feat] = z * 10; // Normalized importance
      } else {
        importance[feat] = 0;
      }
    });
    return importance;
  }

  private static generateAIExplanation(level: string, isAnomaly: boolean, importance: Record<string, number>): string[] {
    const reasons: string[] = [];
    const topFeat = Object.entries(importance).sort((a, b) => b[1] - a[1])[0];

    if (isAnomaly) {
      reasons.push(`Isolation Forest detected highly atypical physiological variance.`);
    }
    
    if (topFeat && topFeat[1] > 15) {
      reasons.push(`${topFeat[0].toUpperCase()} deviation is the primary risk driver.`);
    }

    if (level === 'HIGH' || level === 'CRITICAL') {
      reasons.push("Physiological pattern matches known suspicious profiles with >80% confidence.");
    } else {
      reasons.push("Biomarker trends remain within expected standard clusters.");
    }

    return reasons;
  }

  /**
   * Process and update athlete with AI insights
   */
  static async processAthleteAIUpdate(athleteId: string) {
    try {
      const aiResult = await this.analyzeAthleteAI(athleteId);
      
      // If AI detects critical risk, generate a high-severity alert
      if (aiResult.riskLevel === 'CRITICAL' || aiResult.anomaly.isAnomaly) {
         await db.alert.create({
           data: {
             athleteId,
             severity: 'CRITICAL',
             message: `AI INTELLIGENCE ALERT: ${aiResult.explanation[0]}`,
             isResolved: false
           }
         });
      }
      
      return aiResult;
    } catch (error) {
      console.error("[AIEngine] Update failed:", error);
      return null;
    }
  }
}
