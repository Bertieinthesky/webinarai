/**
 * jobs.ts — Job enqueue helpers
 *
 * PURPOSE:
 *   Convenience functions for adding jobs to the processing queues.
 *   These are called by the /api/projects/[id]/process route when the
 *   user clicks "Process All Variants".
 *
 * JOB NAMING:
 *   Each job gets a deterministic jobId based on its target (segment or
 *   variant ID). This prevents duplicate jobs — if a normalize job for
 *   segment X is already in the queue, adding another with the same
 *   jobId is a no-op.
 *
 * USED BY:
 *   - /api/projects/[id]/process route (enqueues normalize jobs)
 *   - video-processor.ts worker (enqueues render jobs after normalization)
 */

import { normalizeQueue, renderQueue } from "./queues";
import type { NormalizeJobData, RenderJobData } from "./types";

export async function enqueueNormalize(data: NormalizeJobData) {
  return normalizeQueue.add(`normalize-${data.segmentId}`, data, {
    jobId: `normalize-${data.segmentId}`,
  });
}

export async function enqueueRender(data: RenderJobData) {
  return renderQueue.add(`render-${data.variantId}`, data, {
    jobId: `render-${data.variantId}`,
  });
}
