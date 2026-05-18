export interface NormalizedBiomarker {
  parameter: string;
  value: number;
  unit: string;
}

export class NormalizationService {
  private static MAPPINGS: Record<string, string> = {
    'hb': 'Hemoglobin',
    'hgb': 'Hemoglobin',
    'hemoglobin': 'Hemoglobin',
    'hct': 'Hematocrit',
    'hematocrit': 'Hematocrit',
    'epo': 'EPO',
    'erythropoietin': 'EPO',
    'retic %': 'Reticulocytes',
    'retic': 'Reticulocytes',
    'reticulocyte': 'Reticulocytes',
    'reticulocytes': 'Reticulocytes',
    't/e ratio': 'Testosterone Ratio',
    'testosterone ratio': 'Testosterone Ratio',
    'testosterone': 'Testosterone Ratio',
    'red blood cells': 'Red Blood Cells',
    'rbc': 'Red Blood Cells',
    'white blood cells': 'White Blood Cells',
    'wbc': 'White Blood Cells',
    'platelets': 'Platelets',
    'plt': 'Platelets',
    'ferritin': 'Ferritin',
    'sodium': 'Sodium',
    'o2 sat': 'Oxygen Saturation',
    'oxygen saturation': 'Oxygen Saturation',
    'spo2': 'Oxygen Saturation'
  };

  /**
   * Normalizes biomarker names and units
   */
  static normalize(rawName: string, rawValue: string, rawUnit: string): NormalizedBiomarker | null {
    const cleanName = rawName.toLowerCase().trim();
    const mappedName = this.MAPPINGS[cleanName] || rawName;

    let value = parseFloat(rawValue.replace(',', '.'));
    if (isNaN(value)) return null;

    let unit = rawUnit.trim();

    // Unit conversion logic (Simplified for demo)
    // Example: g/L to g/dL
    if (mappedName === 'Hemoglobin' && unit.toLowerCase() === 'g/l') {
      value = value / 10;
      unit = 'g/dL';
    }

    return {
      parameter: mappedName,
      value,
      unit
    };
  }
}
