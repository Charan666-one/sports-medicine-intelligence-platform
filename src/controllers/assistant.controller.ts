import { Request, Response } from 'express';
import { InvestigationAssistantService } from '../services/investigationAssistant.service.js';

export class AssistantController {
  static async ask(req: Request, res: Response) {
    const { athleteId } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Missing query parameter." });
    }

    try {
      const response = await InvestigationAssistantService.handleQuery(query, athleteId);
      res.json({ status: 'success', data: response });
    } catch (error: any) {
      console.error("Assistant Error:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
