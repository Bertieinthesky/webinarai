/**
 * split.ts — Stream-copy video splitting at marker positions
 *
 * PURPOSE:
 *   Splits a source video into individual clips using FFmpeg stream-copy.
 *   Cuts land on the nearest keyframe before the requested time — this is
 *   a v1 trade-off: splitting is near-instant but cuts may be 0-2 seconds
 *   off from the exact marker position. Acceptable for VSL segmentation
 *   where markers are placed at scene changes (which are usually keyframes).
 *
 * ARCHITECTURE:
 *   - Used by: video-processor.ts (processSplit worker)
 *   - Depends on: commands.ts (runFFmpeg wrapper)
 */

import { runFFmpeg } from "./commands";

export interface SplitClipSpec {
  startMs: number;
  endMs: number;
  outputPath: string;
}

/**
 * Split a single clip from a source video using stream-copy.
 * Uses -ss before -i for fast keyframe-accurate seeking.
 */
export async function splitVideoClip(
  inputPath: string,
  clip: SplitClipSpec
): Promise<void> {
  const startSec = clip.startMs / 1000;
  const durationSec = (clip.endMs - clip.startMs) / 1000;

  const args = [
    "-ss",
    String(startSec),
    "-i",
    inputPath,
    "-t",
    String(durationSec),
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero",
    "-y",
    clip.outputPath,
  ];

  await runFFmpeg(args, 300_000); // 5-minute timeout per clip
}
