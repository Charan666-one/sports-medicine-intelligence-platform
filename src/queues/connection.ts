import IORedis, { Redis } from 'ioredis';
import { config } from '../config/index.js';

/**
 * Shared Redis connection factory for BullMQ queues/workers and the event
 * pub/sub bridge. BullMQ requires `maxRetriesPerRequest: null` on its
 * connections (it manages retries itself); reuse this factory rather than
 * constructing ioredis clients ad hoc.
 */
export function createRedisConnection(): Redis {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
