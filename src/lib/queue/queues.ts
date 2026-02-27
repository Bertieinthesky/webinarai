/**
 * queues.ts — BullMQ queue instances
 *
 * PURPOSE:
 *   Creates and exports the two BullMQ queues used for video processing.
 *   These queues are used by the API routes to enqueue jobs and by the
 *   video-processor worker to consume them.
 *
 * QUEUES:
 *   - "normalize": Segment normalization jobs (re-encode to target specs)
 *   - "render": Variant rendering jobs (stitch + extract hook clip)
 *
 * JOB OPTIONS:
 *   - 3 retry attempts with exponential backoff (1s, 2s, 4s)
 *   - Completed jobs kept for 24 hours (for debugging/monitoring)
 *   - Failed jobs kept for 7 days (for investigation)
 *
 * ARCHITECTURE:
 *   - Used by: jobs.ts (enqueue functions), video-processor.ts (Worker)
 *   - Connection: Shared Redis connection from connection.ts
 */

import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import type { NormalizeJobData, RenderJobData } from "./types";

export const normalizeQueue = new Queue<NormalizeJobData>("normalize", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400 }, // keep completed jobs for 24h
    removeOnFail: { age: 604800 }, // keep failed jobs for 7 days
  },
});

export const renderQueue = new Queue<RenderJobData>("render", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});
