import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiEnhancementService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(apiKey);
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
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error("Gemini Enhancement Failed, using deterministic fallback:", err);
      return deterministicSummary;
    }
  }
}
