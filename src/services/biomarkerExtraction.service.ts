import { NormalizationService, NormalizedBiomarker } from './normalization.service.js';

export class BiomarkerExtractionService {
  /**
   * Extracts biomarkers from raw text using pattern matching
   */
  static extract(text: string): NormalizedBiomarker[] {
    const results: NormalizedBiomarker[] = [];
    
    // Pattern: [Name] [Separator] [Value] [Unit]
    // Example: "Hemoglobin 14.5 g/dL" or "EPO: 2.1 mU/mL"
    const lines = text.split('\n');
    
    // Common biomarkers to look for using robust clinical OCR patterns
    const patterns = [
      // Format: Match Name -> Optional Separators -> Number (with or without decimal) -> Optional Units
      /(Hemoglobin|Hb|HGB)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([a-zA-Z/%]*)/i,
      /(Hematocrit|HCT)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([%])?/i,
      /(EPO|Erythropoietin)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([a-zA-Z/]*)/i,
      /(Reticulocytes?|Retic(?:\s*%)?)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([%])?/i,
      /(Testosterone(?:\s*Ratio)?|T\/E\s*Ratio)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([a-zA-Z/%]*)/i,
      /(Red\s*Blood\s*Cells|RBC)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*(?:x?10\^[129]+\/L|[a-zA-Z/%]+)?/i,
      /(White\s*Blood\s*Cells|WBC)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*(?:x?10\^[129]+\/L|[a-zA-Z/%]+)?/i,
      /(Platelets|PLT)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*(?:x?10\^[129]+\/L|[a-zA-Z/%]+)?/i,
      /(Ferritin)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([a-zA-Z/%]*)/i,
      /(Sodium)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([a-zA-Z/%]*)/i,
      /(Oxygen\s*Saturation|O2\s*Sat|SpO2)[\s\t:.*=]*([\d]+[.,][\d]+|[\d]+)[\s]*([%])/i
    ];

    lines.forEach(line => {
      const cleanLine = line.replace(/\*/g, '').trim(); // Remove asterisks often found in reports
      patterns.forEach(regex => {
        const match = cleanLine.match(regex);
        if (match) {
          const normalized = NormalizationService.normalize(
            match[1],
            match[2],
            match[3] || ''
          );
          if (normalized) {
            // Avoid duplicates
            if (!results.find(r => r.parameter === normalized.parameter)) {
              results.push(normalized);
            }
          }
        }
      });
    });

    return results;
  }
}
