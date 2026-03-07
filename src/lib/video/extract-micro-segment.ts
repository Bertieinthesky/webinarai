/**
 * extract-micro-segment.ts — Micro-segment extraction for turbo start
 *
 * PURPOSE:
 *   Extracts the first 1.5 seconds of a variant video as a tiny standalone
 *   MP4 (~50-200KB). On mobile, this micro-segment is blob-preloaded and
 *   plays instantly while the full video buffers in the background.
 *
 * WHY 1.5 SECONDS:
 *   - Small enough to blob-preload instantly (50-200KB at 720p)
 *   - Long enough that the full video's first chunk has time to buffer
 *   - Covers the critical "first impression" moment of the hook
 *
 * PERFORMANCE:
 *   Uses `-c copy` (stream-copy, no re-encoding) — extraction is instant.
 *   The resulting file is a valid standalone MP4 with faststart for streaming.
 *
 * USED BY:
 *   - video-processor.ts (render step, after stitching)
 *   - SimpleMobilePlayer (blob-preloads and plays before full video)
 */

import { runFFmpeg } from "./commands";

const DEFAULT_DURATION_MS = 1500;

export async function extractMicroSegment(
  variantVideoPath: string,
  microSegmentOutputPath: string,
  durationMs: number = DEFAULT_DURATION_MS
): Promise<void> {
  const durationSec = durationMs / 1000;

  await runFFmpeg([
    "-i",
    variantVideoPath,
    "-t",
    String(durationSec),
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    microSegmentOutputPath,
  ]);
}
