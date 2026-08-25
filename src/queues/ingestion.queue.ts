import { Queue, JobsOptions } from 'bullmq';
import { createRedisConnection } from './connection.js';
import { IngestionInput } from '../services/ingestionPipeline.service.js';

export const INGESTION_QUEUE_NAME = 'ingestion';

export interface IngestionJobPayload extends IngestionInput {
  /** The IngestionJob row's id — used to correlate queue jobs back to the DB. */
  ingestionJobId: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 }, // keep 7 days / 1000 jobs
  removeOnFail: { age: 60 * 60 * 24 * 30 }, // keep failures 30 days for investigation
};

/**
 * Whether a failed attempt was the job's last one, i.e. it should be marked
 * DEAD_LETTER (no more retries left) rather than FAILED (BullMQ will retry
 * it with backoff). `attemptsMade` is 0-indexed (BullMQ semantics): a job
 * with `attempts: 3` that just failed its 3rd try reports `attemptsMade: 2`.
 * `maxAttempts` defaults to 1 (no retries) if unset, matching BullMQ.
 */
export function isFinalAttempt(attemptsMade: number, maxAttempts: number | undefined): boolean {
  return attemptsMade + 1 >= (maxAttempts ?? 1);
}

let queue: Queue<IngestionJobPayload> | null = null;

/** Lazily-created singleton queue, so importing this module has no side effects. */
export function getIngestionQueue(): Queue<IngestionJobPayload> {
  if (!queue) {
    queue = new Queue<IngestionJobPayload>(INGESTION_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions,
    });
  }
  return queue;
}

/**
 * Enqueue an ingestion job. Uses the IngestionJob row's id as the BullMQ job
 * id, so re-enqueuing the same ingestionJobId is a no-op (defence in depth
 * alongside the checksum-based idempotency check the controller performs
 * before creating the row).
 */
export async function enqueueIngestionJob(payload: IngestionJobPayload) {
  const q = getIngestionQueue();
  return q.add('process-report', payload, { jobId: payload.ingestionJobId });
}
