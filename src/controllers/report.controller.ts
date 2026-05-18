import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db.js';
import { getSystemUserId } from '../utils/systemUser.js';
import { NotFoundError } from '../errors/AppError.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class ReportController {
  static async getAllReports(req: Request, res: Response, next: NextFunction) {
    try {
      const reports = await db.medicalReport.findMany({
        include: { 
          athlete: true,
          testResults: true 
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ status: 'success', data: { reports } });
    } catch (error) {
      next(error);
    }
  }

  static async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const report = await db.medicalReport.findUnique({
        where: { id },
        include: { 
          athlete: true,
          testResults: true 
        }
      });

      if (!report) throw new NotFoundError('Report not found');

      res.json({ status: 'success', data: { report } });
    } catch (error) {
      next(error);
    }
  }

  static async createReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, athleteId, description } = req.body;
      const systemUserId = await getSystemUserId();
      const report = await db.medicalReport.create({
        data: {
          type,
          athleteId,
          description,
          creatorId: systemUserId, // Should be from auth
          status: 'COMPLETED'
        }
      });
      res.status(201).json({ status: 'success', data: { report } });
    } catch (error) {
      next(error);
    }
  }

  static async generateAISummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const report = await db.medicalReport.findUnique({
        where: { id },
        include: { testResults: true, athlete: true }
      });

      if (!report) throw new NotFoundError('Report not found');

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ 
          status: 'success', 
          data: { 
            summary: `Automated summary for ${report.athlete.name}: Findings include atypical values in ${report.testResults.filter(r => r.isAtypical).map(r => r.parameter).join(', ') || 'no parameters'}. (Note: Setup GEMINI_API_KEY for advanced LLM reasoning)`
          } 
        });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a Medical AI Analyst for an anti-doping agency.
        Summarize the following medical report for athlete ${report.athlete.name}.
        Focus on atypical findings and their implications for the biological passport.
        
        Report Parameters:
        ${report.testResults.map(r => `- ${r.parameter}: ${r.value} ${r.unit} (Atypical: ${r.isAtypical})`).join('\n')}
        
        Keep it professional, concise, and technical.
      `;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      res.json({ status: 'success', data: { summary } });
    } catch (error) {
      next(error);
    }
  }
}
