import * as ss from 'simple-statistics';

export interface FeatureImpact {
  name: string;
  impactWeight: number; // 0-100
  percentage: number;
  direction: 'UP' | 'DOWN' | 'STABLE';
  zScore: number;
}

export class FeatureImpactService {
  /**
   * Calculates the impact of each biomarker on the overall risk prediction
   */
  static calculateImpact(latest: Record<string, number>, history: Record<string, number>[]): FeatureImpact[] {
    const features = Object.keys(latest);
    const impacts: FeatureImpact[] = [];

    features.forEach(feat => {
      const historyVals = history.map(h => h[feat]).filter(v => v !== undefined && v !== null);
      
      if (historyVals.length < 2) {
        impacts.push({
          name: feat,
          impactWeight: 0,
          percentage: 0,
          direction: 'STABLE',
          zScore: 0
        });
        return;
      }

      const mean = ss.mean(historyVals);
      const std = ss.standardDeviation(historyVals) || 0.1;
      const currentVal = latest[feat];
      const zScore = (currentVal - mean) / std;
      
      // Impact weight is based on absolute Z-Score
      // A Z-Score of 3 might be 100% impact for that feature's potential max
      const impactWeight = Math.min(Math.max(Math.abs(zScore) * 33.3, 0), 100);

      impacts.push({
        name: feat,
        impactWeight,
        percentage: 0, // Will calculate below
        direction: zScore > 0.5 ? 'UP' : zScore < -0.5 ? 'DOWN' : 'STABLE',
        zScore
      });
    });

    // Calculate percentages relative to total impact
    const totalImpact = impacts.reduce((sum, i) => sum + i.impactWeight, 0) || 1;
    impacts.forEach(i => {
      i.percentage = Math.round((i.impactWeight / totalImpact) * 100);
    });

    return impacts.sort((a, b) => b.impactWeight - a.impactWeight);
  }
}
