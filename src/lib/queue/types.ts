/**
 * types.ts — BullMQ job payload type definitions
 *
 * PURPOSE:
 *   Typed interfaces for the data passed to and returned from BullMQ jobs.
 *   Two job types exist:
 *
 *   1. NORMALIZE: Re-encodes a single uploaded segment to the project's
 *      target specs. Input: original R2 key. Output: normalized R2 key
 *      + metadata (duration, dimensions, codec, file size).
 *
 *   2. RENDER: Stitches three normalized segments (hook + body + CTA) into
 *      a complete variant video, then extracts the hook clip. Input: three
 *      normalized R2 keys + hook duration. Output: video R2 key + hook clip
 *      R2 key + metadata.
 *
 * USED BY:
 *   - queues.ts (Queue<NormalizeJobData>, Queue<RenderJobData>)
 *   - jobs.ts (enqueueNormalize, enqueueRender)
 *   - video-processor.ts worker (processes jobs and returns results)
 *   - process/route.ts API (creates job payloads)
 */

export interface NormalizeJobData {
  projectId: string;
  segmentId: string;
  originalStorageKey: string;
}

export interface RenderJobData {
  projectId: string;
  variantId: string;
  hookSegmentId: string;
  bodySegmentId: string;
  ctaSegmentId: string;
  hookNormalizedKey: string;
  bodyNormalizedKey: string;
  ctaNormalizedKey: string;
  hookDurationMs: number;
}

export interface NormalizeJobResult {
  normalizedStorageKey: string;
  normalizedSizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface RenderJobResult {
  videoStorageKey: string;
  videoSizeBytes: number;
  videoDurationMs: number;
  hookClipStorageKey: string;
  hookClipSizeBytes: number;
  hookClipDurationMs: number;
  hookEndTimeMs: number;
}
