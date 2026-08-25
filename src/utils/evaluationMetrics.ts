/**
 * Standard binary-classification evaluation metrics (Phase 7: Model
 * Evaluation) — precision, recall, F1, and a confusion matrix, computed
 * from parallel arrays of predicted vs. ground-truth labels. Deliberately
 * dependency-free and framework-agnostic so it can back both automated
 * tests and an ad-hoc evaluation script.
 */
export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export interface ClassificationMetrics extends ConfusionMatrix {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  support: number;
}

export function evaluateBinaryClassification(predicted: boolean[], actual: boolean[]): ClassificationMetrics {
  if (predicted.length !== actual.length) {
    throw new Error(`predicted/actual length mismatch: ${predicted.length} vs ${actual.length}`);
  }
  if (predicted.length === 0) {
    throw new Error('Cannot evaluate an empty dataset');
  }

  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] && actual[i]) truePositives++;
    else if (predicted[i] && !actual[i]) falsePositives++;
    else if (!predicted[i] && actual[i]) falseNegatives++;
    else trueNegatives++;
  }

  const precision = truePositives + falsePositives === 0 ? 0 : truePositives / (truePositives + falsePositives);
  const recall = truePositives + falseNegatives === 0 ? 0 : truePositives / (truePositives + falseNegatives);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const accuracy = (truePositives + trueNegatives) / predicted.length;

  return {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
    accuracy: Number(accuracy.toFixed(3)),
    support: predicted.length,
  };
}
