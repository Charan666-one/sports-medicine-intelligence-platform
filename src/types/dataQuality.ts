/**
 * Shared data-quality taxonomy (Phase 4).
 *
 * A flagged biomarker reading can mean three very different things, and
 * conflating them is itself a risk (a mis-scanned document should never
 * read as a doping alert):
 *
 *   - DATA_ERROR: the extracted value is not physiologically plausible for
 *     a living human, or extraction confidence was too low to trust it.
 *     Most likely an OCR/parsing/unit mistake — needs re-verification
 *     against the source document, not a risk assessment.
 *   - PHYSIOLOGICAL_ANOMALY: the value is plausible and real, but
 *     statistically atypical for this athlete (large deviation from their
 *     own baseline) with no independent population-level red flag. Could
 *     be illness, altitude, dehydration, lab variance — worth monitoring,
 *     not proof of anything.
 *   - RISK_SIGNAL: the value independently crosses a population-level
 *     threshold associated with doping risk (e.g. blood-passport-style
 *     limits), regardless of the athlete's own history. Warrants an alert
 *     for analyst review.
 */
export type DataQualityCategory = 'DATA_ERROR' | 'PHYSIOLOGICAL_ANOMALY' | 'RISK_SIGNAL';

export interface DataQualityFinding {
  category: DataQualityCategory;
  /** Biomarker/parameter name the finding is about (e.g. "Hemoglobin", "epo"). */
  parameter: string;
  message: string;
}
