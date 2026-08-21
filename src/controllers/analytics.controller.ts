import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';

/**
 * Analytics / intelligence endpoints that compute real aggregates from the
 * database to drive the Dashboard and Anti-Doping visualisations (no mock data).
 */

const MODEL_VERSION = 'V1-HEURISTIC-XAI';

// Clinical reference midpoints used to express a marker as a % of its baseline
// (100 = exactly at reference; >100 = elevated). Purely for the radar scale.
const MARKER_BASELINE: Record<string, number> = {
  Hemoglobin: 15,        // g/dL
  Hematocrit: 45,        // %
  Reticulocytes: 1,      // %
  EPO: 8,                // mU/mL
  'Testosterone Ratio': 1,
  'Oxygen Saturation': 98, // %
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 1) => Number(n.toFixed(d));

/**
 * GET /api/v1/anti-doping/overview
 * High-level anti-doping intelligence summary.
 */
export const getAntiDopingOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalAthletes, flaggedAthletes, totalReports, flaggedReports, anomalyCount, avgRisk, latestPrediction] =
      await Promise.all([
        db.athlete.count({ where: { deletedAt: null } }),
        db.athlete.count({ where: { deletedAt: null, status: 'UNDER_INVESTIGATION' } }),
        db.medicalReport.count(),
        db.medicalReport.count({ where: { status: 'FLAGGED' } }),
        db.aIPrediction.count({ where: { isAnomaly: true } }),
        db.riskAssessment.aggregate({ _avg: { score: true } }),
        db.aIPrediction.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      ]);

    const complianceRate = totalReports > 0 ? round(((totalReports - flaggedReports) / totalReports) * 100) : 100;
    const flaggedRatio = totalAthletes > 0 ? flaggedAthletes / totalAthletes : 0;
    const auditStatus =
      flaggedRatio > 0.25 ? 'CRITICAL' : flaggedRatio > 0.1 ? 'ELEVATED' : anomalyCount > 0 ? 'MONITORING' : 'NOMINAL';

    res.json({
      status: 'success',
      data: {
        summary: {
          totalAthletes,
          flaggedAthletes,
          totalReports,
          flaggedReports,
          anomalyCount,
          auditStatus,
        },
        intelligenceMetrics: {
          complianceRate,
          avgRiskScore: round(avgRisk._avg.score ?? 0),
          modelVersion: MODEL_VERSION,
          lastSyncedAt: (latestPrediction?.createdAt ?? new Date()).toISOString(),
          activeSurveillanceNodes: totalAthletes,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/analytics/risk-trend?months=6
 * Monthly average risk score and report volume — drives the Dashboard area chart.
 */
export const getRiskTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clamp(parseInt(String(req.query.months ?? '6'), 10) || 6, 1, 24);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [assessments, reports] = await Promise.all([
      db.riskAssessment.findMany({ where: { createdAt: { gte: start } }, select: { score: true, createdAt: true } }),
      db.medicalReport.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    ]);

    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets: { name: string; year: number; month: number; riskSum: number; riskN: number; tests: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
      buckets.push({ name: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), riskSum: 0, riskN: 0, tests: 0 });
    }
    const findBucket = (d: Date) => buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());

    for (const a of assessments) {
      const b = findBucket(new Date(a.createdAt));
      if (b) { b.riskSum += a.score; b.riskN += 1; }
    }
    for (const r of reports) {
      const b = findBucket(new Date(r.createdAt));
      if (b) b.tests += 1;
    }

    const data = buckets.map((b) => ({ name: b.name, risk: b.riskN > 0 ? round(b.riskSum / b.riskN) : 0, tests: b.tests }));
    res.json({ status: 'success', data: { trend: data } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/anti-doping/marker-variance
 * Average biomarker levels across the roster, expressed as % of clinical
 * baseline — drives the Anti-Doping radar chart.
 */
export const getMarkerVariance = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const markers = Object.keys(MARKER_BASELINE);
    const grouped = await db.testResult.groupBy({
      by: ['parameter'],
      where: { parameter: { in: markers } },
      _avg: { value: true },
    });
    const avgByParam = new Map(grouped.map((g) => [g.parameter, g._avg.value ?? 0]));

    const data = markers.map((subject) => {
      const avg = avgByParam.get(subject) ?? 0;
      const baseline = MARKER_BASELINE[subject];
      // 100 = at baseline; clamp to the radar's 0..150 range.
      const A = avg > 0 ? clamp(round((avg / baseline) * 100), 0, 150) : 0;
      return { subject, A, fullMark: 150 };
    });

    res.json({ status: 'success', data: { markers: data } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/anti-doping/longitudinal?parameter=Hemoglobin&limit=30
 * Time series of a single biomarker across all athletes — drives the scatter chart.
 */
export const getLongitudinal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parameter = String(req.query.parameter ?? 'Hemoglobin');
    const limit = clamp(parseInt(String(req.query.limit ?? '40'), 10) || 40, 1, 200);

    const results = await db.testResult.findMany({
      where: { parameter },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { value: true, isAtypical: true, createdAt: true },
    });

    const series = results.map((r, i) => ({
      x: i + 1,
      y: round(r.value, 2),
      z: r.isAtypical ? 200 : 100, // bubble size — atypical points stand out
      date: r.createdAt.toISOString(),
      atypical: r.isAtypical,
    }));

    res.json({ status: 'success', data: { parameter, series } });
  } catch (error) {
    next(error);
  }
};
