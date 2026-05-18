import { db } from './db.js';
import { AnomalyEngineService } from './anomalyEngine.service.js';

export interface RiskResult {
  score: number;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  reasoning: string[];
  anomalies: string[];
}

export class RiskEngineService {
  /**
   * Thresholds based on general sports medicine / WADA guidelines (simplified for demo)
   */
  private static THRESHOLDS = {
    HEMOGLOBIN: { max: 17.5 },
    HEMATOCRIT: { max: 50.0 },
    TESTOSTERONE_RATIO: { max: 4.0 },
    RETICULOCYTES: { min: 0.5, max: 2.2 },
    EPO: { max: 10.0 }
  };

  /**
   * Main calculation entry point for an athlete
   */
  static async calculateAthleteRisk(athleteId: string): Promise<RiskResult> {
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      include: {
        reports: {
          include: { testResults: true },
          orderBy: { createdAt: 'desc' },
          take: 10 // Increased for better statistical analysis
        }
      }
    });

    if (!athlete || athlete.reports.length === 0) {
      return { score: 0, severity: 'LOW', reasoning: ['No medical reports found for assessment.'], anomalies: [] };
    }

    console.log(`[RiskEngine] Analyzing athlete: ${athlete.name} (${athlete.id})`);
    
    const latestReport = athlete.reports[0];
    const previousReports = athlete.reports.slice(1);

    let riskScore = 0;
    const reasoning: string[] = [];
    const anomalies: string[] = [];

    // 1. Static Threshold Analysis (Phase 1 Heuristics)
    latestReport.testResults.forEach(result => {
      const param = result.parameter.toUpperCase();
      const val = result.value;

      if (param.includes('HEMOGLOBIN')) {
        if (val > this.THRESHOLDS.HEMOGLOBIN.max) {
          riskScore += 25;
          reasoning.push(`Critical Hemoglobin level detected (${val} g/dL).`);
          anomalies.push('HEMOGLOBIN_EXCEEDED');
        }
      }

      if (param.includes('HEMATOCRIT')) {
        if (val > this.THRESHOLDS.HEMATOCRIT.max) {
          riskScore += 20;
          reasoning.push(`Elevated Hematocrit level (${val}%).`);
          anomalies.push('HEMATOCRIT_EXCEEDED');
        }
      }

      if (param.includes('TESTOSTERONE')) {
        if (val > this.THRESHOLDS.TESTOSTERONE_RATIO.max) {
          riskScore += 40;
          reasoning.push(`Abnormal T/E Ratio detected (${val}).`);
          anomalies.push('TE_RATIO_EXCEEDED');
        }
      }
      
      if (param.includes('EPO')) {
        if (val > this.THRESHOLDS.EPO.max) {
          riskScore += 40;
          reasoning.push(`Synthetic EPO indicators detected (${val} mU/mL).`);
          anomalies.push('EPO_EXCEEDED');
        }
      }

      if (param.includes('RETICULOCYTE')) {
        if (val > this.THRESHOLDS.RETICULOCYTES.max || val < this.THRESHOLDS.RETICULOCYTES.min) {
          riskScore += 15;
          reasoning.push(`Reticulocyte variance outside physiological normal (${val}%).`);
          anomalies.push('RETICULOCYTE_ANOMALY');
        }
      }
    });

    // 2. Statistical Anomaly Analysis (Phase 2 Intelligence)
    const stats = await AnomalyEngineService.analyzeLongitudinalTrends(athleteId);
    
    if (stats.overallAnomalyScore > 0) {
      riskScore += stats.overallAnomalyScore * 0.5; // Weight statistical anomalies
      stats.insights.forEach(insight => {
        if (insight.isAnomaly || insight.message.includes('Significant')) {
          reasoning.push(`STATS: ${insight.message}`);
          anomalies.push(`${insight.parameter}_STAT_ANOMALY`);
        }
      });
      
      if (stats.stabilityIndex < 60) {
        reasoning.push(`UNSTABLE: Athlete biological passport shows high variance (Stability Index: ${stats.stabilityIndex.toFixed(1)}%).`);
        anomalies.push('HIGH_VARIANCE_PROFILE');
      }
    }

    // Cap the risk score at 100
    riskScore = Math.min(100, riskScore);

    // Determine Severity
    let severity: RiskResult['severity'] = 'LOW';
    if (riskScore > 80) severity = 'CRITICAL';
    else if (riskScore > 50) severity = 'HIGH';
    else if (riskScore > 20) severity = 'MODERATE';

    return { score: riskScore, severity, reasoning, anomalies };
  }

  /**
   * Persist calculation to database and generate alerts if necessary
   */
  static async processAthleteUpdate(athleteId: string) {
    const result = await this.calculateAthleteRisk(athleteId);

    // Create risk assessment record
    await db.riskAssessment.create({
      data: {
        athleteId,
        score: result.score,
        category: result.severity,
        findings: JSON.stringify(result.reasoning),
        modelName: 'BIOMARKER_ENGINE_V1'
      }
    });

    // Generate flags/alerts for High/Critical risk
    if (result.score > 50) {
      await db.alert.create({
        data: {
          athleteId,
          severity: result.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          message: `Medical Engine Flag: ${result.reasoning[0] || 'Atypical physiological variation detected.'}`,
          isResolved: false
        }
      });
    }

    return result;
  }
}
