import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from "../config/index.js";

export class GeminiEnhancementService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getClient() {
    if (!geminiApiKey) return null;

    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
    }
    return this.genAI;
  }

  /**
   * Enhances a deterministic medical summary with professional medical wording.
   * FALLS BACK to original if API key is missing or call fails.
   */
  static async enhanceSummary(deterministicSummary: string, findings: string[]): Promise<string> {
    const client = this.getClient();
    if (!client) return deterministicSummary;

    try {
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
        You are a Sports Medicine Intelligence Assistant. 
        Enhance the following deterministic medical summary into a professional, clear, and concise medical intelligence report.
        Summarize the findings and explain the risk context professionally.
        
        DETERMINISTIC DATA:
        ${deterministicSummary}

        FINDINGS:
        ${findings.join('\n')}

        Keep it clinical and objective. Do not add medical advice. Do not hallucinate data.
        This is a statistical risk-screening tool, not a doping determination. Never state or
        imply that doping has been proven, confirmed, or detected — describe findings only as
        risk indicators or physiological anomalies that warrant human analyst review. Do not use
        words like "doping", "doper", "cheating", or "guilty" to describe the athlete.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error("Gemini Enhancement Failed, using deterministic fallback:", err);
      return deterministicSummary;
    }
  }
}
