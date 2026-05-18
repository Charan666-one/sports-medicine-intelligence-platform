import { db } from './db.js';
import { MedicalReasoningService } from './medicalReasoning.service.js';

export interface AssistantResponse {
  answer: string;
  data?: any;
  suggestions?: string[];
}

export class InvestigationAssistantService {
  /**
   * Processes natural language queries about athlete intelligence deterministically.
   */
  static async handleQuery(query: string, athleteId: string): Promise<AssistantResponse> {
    const q = query.toLowerCase();
    
    // Fetch latest intelligence context
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      include: {
        aiPredictions: { orderBy: { createdAt: 'desc' }, take: 1 },
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!athlete) return { answer: "Athlete record not found in biological database." };

    const latestPrediction = athlete.aiPredictions[0];
    
    // 1. "Why was athlete flagged?"
    if (q.includes('flag') || q.includes('why') || q.includes('reason')) {
      if (!latestPrediction) return { answer: "No AI intelligence data available for this athlete yet." };
      
      const reasoning = JSON.parse(latestPrediction.reasoningJSON || '{}');
      const findings = reasoning.findings || [];

      return {
        answer: `Athlete ${athlete.name} has a ${latestPrediction.riskLevel} risk status (Score: ${(latestPrediction.anomalyScore * 100).toFixed(1)}%). The primary triggers identified by the reasoning engine: ${findings.slice(0, 2).join(' and ')}.`,
        suggestions: ["Compare to historical baseline", "Show biomarker trends", "Download medical summary"]
      };
    }

    // 2. "What changed?"
    if (q.includes('change') || q.includes('recent') || q.includes('differ')) {
      if (!latestPrediction) return { answer: "Insufficient history to detect recent biological shifts." };

      const reasoning = JSON.parse(latestPrediction.reasoningJSON || '{}');
      const findings = reasoning.findings || [];

      return {
        answer: `The most recent ingestion detected ${findings.length || 0} significant deviations. Compared to 90-day baseline, physiological stability has shifted by ${(100 - latestPrediction.stabilityIndex * 100).toFixed(1)}%.`,
        suggestions: ["Show raw text audit", "List all biomarkers"]
      };
    }

    // 3. "Which biomarkers?"
    if (q.includes('biomarker') || q.includes('value') || q.includes('parameter')) {
      const markers = await db.testResult.findMany({
        where: { report: { athleteId } },
        orderBy: { report: { createdAt: 'desc' } },
        take: 5
      });
      
      const list = markers.map(m => `${m.parameter}: ${m.value} ${m.unit}`).join('\n');
      return {
        answer: `Latest extracted biomarkers:\n${list}`,
        suggestions: ["Check for EPO anomalies", "Recalculate risk index"]
      };
    }

    // Default Fallback
    return {
      answer: "I am functioning in local deterministic mode. I can explain risk factors, biomarker changes, and ingestion status. Try asking 'Why is this athlete flagged?' or 'What changed recently?'.",
      suggestions: ["Why flagged?", "What changed?", "Show biomarkers"]
    };
  }
}
