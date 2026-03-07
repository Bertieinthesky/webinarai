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
 *   3. HLS_PACKAGE: Packages a rendered variant MP4 into HLS adaptive
 *      bitrate streams (1080p, 720p, 480p). Runs as a separate background
 *      job after render completes. Best-effort — failure doesn't affect
 *      the variant's "rendered" status.
 *
 * USED BY:
 *   - queues.ts (Queue<NormalizeJobData>, Queue<RenderJobData>, Queue<HlsPackageJobData>)
 *   - jobs.ts (enqueueNormalize, enqueueRender, enqueueHlsPackage)
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

export interface HlsPackageJobData {
  projectId: string;
  variantId: string;
  videoStorageKey: string;
}

export interface HlsPackageJobResult {
  hlsMasterManifestKey: string;
}

export interface SplitJobData {
  splitId: string;
  sourceStorageKey: string;
  clips: Array<{
    clipId: string;
    clipIndex: number;
    startMs: number;
    endMs: number;
    label: string;
    outputStorageKey: string;
  }>;
}

export interface SplitJobResult {
  splitId: string;
  clipCount: number;
}

export interface AnalyzeJobData {
  splitId: string;
  sourceStorageKey: string;
  threshold?: number; // scene detection threshold, default 0.3
}

export interface AnalyzeJobResult {
  splitId: string;
  pointCount: number;
}
