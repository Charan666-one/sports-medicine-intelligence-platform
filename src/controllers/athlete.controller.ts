import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { NotFoundError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { RiskEngineService } from '../services/riskEngine.service.js';
import { AnomalyEngineService } from '../services/anomalyEngine.service.js';
import { AIEngineService } from '../services/aiEngine.service.js';
import { SocketService } from '../services/socket.service.js';

/**
 * Safely parses stringified JSON structures with a fallback mechanism.
 */
const safeJsonParse = (data: any, fallback: any = []) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
};

/**
 * Retrieves all active, non-deleted athlete records with latest insights.
 */
export const getAllAthletes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const athletesRaw = await db.athlete.findMany({
      include: {
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        aiPredictions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        organization: true
      },
      where: { deletedAt: null }
    });

    const athletes = athletesRaw.map(a => ({
      ...a,
      riskScore: a.riskAssessments[0]?.score || 0,
    }));

    res.json({
      status: 'success',
      results: athletes.length,
      data: { athletes }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a detailed, single athlete snapshot matching strict frontend models.
 */
export const getAthleteById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const athleteRaw = await db.athlete.findUnique({
      where: { id },
      include: {
        reports: {
          include: { testResults: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        aiPredictions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        medicalProfile: true,
        organization: true
      }
    });

    if (!athleteRaw) {
      throw new NotFoundError(`Athlete with ID ${id} not found`);
    }

    const latestAssessment = athleteRaw.riskAssessments[0];
    const latestAIPrediction = athleteRaw.aiPredictions[0];

    const athlete = {
      ...athleteRaw,
      riskScore: latestAssessment?.score || 0,
      riskFindings: safeJsonParse(latestAssessment?.findings, []),
      aiInsights: latestAIPrediction ? {
        riskLevel: latestAIPrediction.riskLevel,
        probability: safeJsonParse(latestAIPrediction.riskProbability, '0%'),
        anomaly: {
          isAnomaly: latestAIPrediction.isAnomaly,
          score: latestAIPrediction.anomalyScore
        },
        explanation: safeJsonParse(latestAIPrediction.explanation, ''),
        importance: safeJsonParse(latestAIPrediction.featureImportance, {}),
        confidence: {
          score: latestAIPrediction.confidenceScore,
          label: latestAIPrediction.reliabilityLabel
        },
        stabilityIndex: latestAIPrediction.stabilityIndex,
        reasoning: safeJsonParse(latestAIPrediction.reasoningJSON, null),
        longitudinal: safeJsonParse(latestAIPrediction.longitudinalData, null)
      } : null
    };

    res.json({
      status: 'success',
      data: { athlete }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Extracts longitudinal trends and calculations for a given athlete record.
 */
export const getAthleteStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const stats = await AnomalyEngineService.analyzeLongitudinalTrends(id);
    res.json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manages targeted AI processing tasks for a single athlete execution thread.
 */
export const runAthleteAIAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await AIEngineService.processAthleteAIUpdate(id);
    res.json({
      status: 'success',
      data: { result }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Re-calibrates the risk engine matrix parameters for a single athlete record.
 */
export const recalculateAthleteRisk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await RiskEngineService.processAthleteUpdate(id);
    await AIEngineService.processAthleteAIUpdate(id);
    
    res.json({
      status: 'success',
      data: { result }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PERMANENT FIX: Multi-tier recalculation cluster.
 * Runs downstream engine calculations safely and protects execution pipelines 
 * against unhandled runtime errors.
 */
export const recalculateAllAthletesRisk = async (req: Request, res: Response, next: NextFunction) => {
  const syncId = `SYNC-OP-${Date.now()}`;
  logger.info(`[${syncId}] Global AI surveillance recalculation process initialized.`);

  try {
    // 1. Fetch only records matching active tracking criteria
    const athletes = await db.athlete.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true }
    });

    // 2. Handle empty database scenarios safely without crashing calculations
    if (!athletes || athletes.length === 0) {
      logger.warn(`[${syncId}] No active athletes detected in system storage. Bypassing calculations.`);
      res.json({
        status: 'success',
        data: {
          processed: 0,
          failed: 0,
          executionSummary: []
        }
      });
      return;
    }

    const results = [];
    let failuresCount = 0;

    // 3. Isolated Loop Architecture: Process records sequentially
    for (const athlete of athletes) {
      try {
        logger.info(`[${syncId}] Running risk engine parameters for ID: ${athlete.id}`);
        
        // Execute calculations sequentially
        const riskResult = await RiskEngineService.processAthleteUpdate(athlete.id);
        const aiResult = await AIEngineService.processAthleteAIUpdate(athlete.id);

        results.push({
          athleteId: athlete.id,
          status: 'SUCCESS',
          riskMetrics: riskResult || null,
          aiMetrics: aiResult || null
        });
      } catch (innerIterationError: any) {
        failuresCount++;
        logger.error(`[${syncId}] Recalculation bypassed for Athlete ID [${athlete.id}]: ${innerIterationError.message}`);
        
        results.push({
          athleteId: athlete.id,
          status: 'FAILED',
          error: innerIterationError.message || 'Internal logic engine exception.'
        });
      }
    }

    // 4. Send socket broadcasts out safely after calculations wrap up
    try {
      SocketService.emitActivity({
        type: 'GLOBAL_AI_SYNC_COMPLETED',
        message: `Surveillance index synchronization completed. Synced: ${results.length - failuresCount} records. Failures: ${failuresCount}.`,
        severity: failuresCount > 0 ? 'WARNING' : 'SUCCESS',
        data: { syncId, processedCount: results.length }
      });
    } catch (socketEmissionError: any) {
      logger.error(`[${syncId}] Post-sync real-time socket alert broadcast failed to emit: ${socketEmissionError.message}`);
    }

    // 5. Return standardized, safe JSON responses directly to the client view helper
    res.json({
      status: 'success',
      data: {
        processed: results.length,
        successfulCount: results.length - failuresCount,
        failedCount: failuresCount,
        details: results
      }
    });

  } catch (globalPipelineException: any) {
    logger.error(`[${syncId}] Fatal platform system collapse inside global computation pipeline: ${globalPipelineException.message}`);
    next(globalPipelineException);
  }
};

/**
 * Creates and enters clean profiles into tracking engines.
 */
export const createAthlete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, dateOfBirth, gender, nationality, sport, organizationId } = req.body;

    let orgId = organizationId;
    if (!orgId) {
      const org = await db.organization.findFirst();
      if (!org) {
        const newOrg = await db.organization.create({
          data: { name: 'Global Anti-Doping Agency', slug: 'gada' }
        });
        orgId = newOrg.id;
      } else {
        orgId = org.id;
      }
    }

    const athlete = await db.athlete.create({
      data: {
        name,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        nationality,
        sport,
        organizationId: orgId,
        status: 'ACTIVE'
      }
    });

    try {
      await RiskEngineService.processAthleteUpdate(athlete.id);
    } catch (engineInitError: any) {
      logger.error(`Initial risk score setup bypassed for athlete ${athlete.id}: ${engineInitError.message}`);
    }
    
    const systemUserId = await getSystemUserId();
    await db.activityLog.create({
      data: {
        userId: systemUserId,
        action: 'ATHLETE_REGISTERED',
        details: `New athlete registered: ${name}`
      }
    });

    try {
      SocketService.emitActivity({
        type: 'ATHLETE_REGISTERED',
        message: `${name} has been enrolled into the biological surveillance program.`,
        severity: 'INFO',
        data: { athleteId: athlete.id }
      });
    } catch (socketError) {
      logger.error(`Failed to emit registration alert over sockets: ${socketError}`);
    }

    res.status(201).json({
      status: 'success',
      data: { athlete }
    });
  } catch (error) {
    next(error);
  }
};