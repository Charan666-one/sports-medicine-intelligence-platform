import { Request, Response } from 'express';
import { InvestigationAssistantService } from '../services/investigationAssistant.service.js';
import { assertAthleteInOrg } from '../utils/scope.js';
import { AppError } from '../errors/AppError.js';

export class AssistantController {
  static async ask(req: Request, res: Response) {
    const { athleteId } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Missing query parameter." });
    }

    try {
      await assertAthleteInOrg(req, athleteId);
      const response = await InvestigationAssistantService.handleQuery(query, athleteId);
      res.json({ status: 'success', data: response });
    } catch (error: any) {
      // Preserve intended status codes (e.g. 404 for a missing / cross-tenant
      // athlete) instead of masking every failure as a 500.
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      if (statusCode >= 500) console.error('Assistant Error:', error);
      res.status(statusCode).json({ status: 'error', message: error.message });
    }
  }
}
