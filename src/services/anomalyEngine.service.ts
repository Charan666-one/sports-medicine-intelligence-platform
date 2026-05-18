import { db } from './db.js';

export interface AnomalyInsight {
  parameter: string;
  zScore: number;
  movingAverage: number;
  standardDeviation: number;
  variance: number;
  isAnomaly: boolean;
  confidence: number;
  message: string;
}

export interface StatisticalSummary {
  athleteId: string;
  insights: AnomalyInsight[];
  overallAnomalyScore: number; // 0-100
  stabilityIndex: number; // 0-100, where 100 is perfectly stable
}

export class AnomalyEngineService {
  /**
   * Performs longitudinal statistical analysis for an athlete
   */
  static async analyzeLongitudinalTrends(athleteId: string): Promise<StatisticalSummary> {
    const reports = await db.medicalReport.findMany({
      where: { athleteId },
      include: { testResults: true },
      orderBy: { createdAt: 'asc' }, // Order by time to calculate moving averages
    });

    if (reports.length < 2) {
      return { athleteId, insights: [], overallAnomalyScore: 0, stabilityIndex: 100 };
    }

    const parameterGroups: Record<string, number[]> = {};

    // Group all historical values by parameter
    reports.forEach(report => {
      report.testResults.forEach(result => {
        const param = result.parameter.toUpperCase();
        if (!parameterGroups[param]) parameterGroups[param] = [];
        parameterGroups[param].push(result.value);
      });
    });

    const insights: AnomalyInsight[] = [];
    let cumulativeAnomalyScore = 0;
    let totalParametersAnalyzed = 0;

    for (const [param, values] of Object.entries(parameterGroups)) {
      if (values.length < 3) continue; // Need at least 3 points for meaningful statistics

      const latestValue = values[values.length - 1];
      const historicalValues = values.slice(0, -1);
      
      const mean = this.calculateMean(historicalValues);
      const stdDev = this.calculateStdDev(historicalValues, mean);
      const variance = Math.pow(stdDev, 2);
      
      // Z-Score: how many standard deviations away from the historical mean
      // Clamp stdDev to a minimum to avoid division by zero
      const safeStdDev = stdDev || 0.1;
      const zScore = (latestValue - mean) / safeStdDev;
      
      // Moving Average (Window of 5)
      const windowSize = 5;
      const movingAverage = this.calculateMean(values.slice(-windowSize));

      const isAnomaly = Math.abs(zScore) > 2.5; // Standard threshold for significant outliers
      let confidence = 0;
      let message = '';

      if (isAnomaly) {
        confidence = Math.min(Math.abs(zScore) * 15, 100);
        const direction = zScore > 0 ? 'increase' : 'decrease';
        message = `Sudden ${direction} in ${param} detected. Z-Score: ${zScore.toFixed(2)}.`;
        cumulativeAnomalyScore += Math.abs(zScore) * 10;
      }

      // Sudden jump detection (more than 2 std devs or 20% absolute change if std dev is small)
      const percentChange = ((latestValue - mean) / (mean || 1)) * 100;
      if (Math.abs(percentChange) > 25 && !isAnomaly) {
        message = `Significant ${param} shift (${percentChange.toFixed(1)}%) relative to baseline.`;
        cumulativeAnomalyScore += 15;
      }

      insights.push({
        parameter: param,
        zScore,
        movingAverage,
        standardDeviation: stdDev,
        variance,
        isAnomaly,
        confidence,
        message: message || `${param} behavior within normal statistical bounds.`
      });
      
      totalParametersAnalyzed++;
    }

    const overallAnomalyScore = Math.min(100, cumulativeAnomalyScore);
    const stabilityIndex = Math.max(0, 100 - (overallAnomalyScore * 0.8));

    return {
      athleteId,
      insights,
      overallAnomalyScore,
      stabilityIndex
    };
  }

  private static calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private static calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = this.calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Helper to integrate statistical findings into the main risk engine findings
   */
  static async getStatisticalFindings(athleteId: string): Promise<string[]> {
    const summary = await this.analyzeLongitudinalTrends(athleteId);
    return summary.insights
      .filter(i => i.isAnomaly || i.message.includes('Significant'))
      .map(i => i.message);
  }
}
