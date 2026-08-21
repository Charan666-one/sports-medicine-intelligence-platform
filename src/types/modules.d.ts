// Minimal type declarations for third-party packages that ship no types.

declare module 'ml-isolation-forest' {
  export class IsolationForest {
    constructor(options?: { nEstimators?: number });
    train(trainingSet: number[][]): void;
    predict(data: number[][]): number[];
  }
}
