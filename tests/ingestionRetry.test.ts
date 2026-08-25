import { describe, it, expect } from 'vitest';
import { isFinalAttempt } from '../src/queues/ingestion.queue.js';

describe('isFinalAttempt (ingestion dead-letter decision)', () => {
  it('is not final while retries remain (attempts: 3)', () => {
    expect(isFinalAttempt(0, 3)).toBe(false); // 1st attempt just failed
    expect(isFinalAttempt(1, 3)).toBe(false); // 2nd attempt just failed
  });

  it('is final on the last configured attempt (attempts: 3)', () => {
    expect(isFinalAttempt(2, 3)).toBe(true); // 3rd attempt just failed — no more retries
  });

  it('treats an unset attempts option as no-retry (max 1 attempt)', () => {
    expect(isFinalAttempt(0, undefined)).toBe(true);
  });

  it('is final if attemptsMade somehow exceeds maxAttempts (defensive)', () => {
    expect(isFinalAttempt(5, 3)).toBe(true);
  });
});
