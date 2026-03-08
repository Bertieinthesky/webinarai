/**
 * extract-hook.ts — Hook clip extraction for instant playback
 *
 * PURPOSE:
 *   Creates a small, standalone video clip containing just the "hook" portion
 *   of a stitched variant video. This clip is the secret to instant playback
 *   in the embed player.
 *
 * HOW THE PRELOADING TRICK WORKS:
 *   The embed player uses TWO <video> elements:
 *     1. Visible player → loads and plays this small hook clip instantly (~2MB)
 *     2. Hidden player → buffers the full variant video in the background
 *   When the hook clip finishes playing, the player seamlessly swaps to the
 *   full video (seeked to the exact hook end timestamp). The viewer perceives
 *   one continuous video that started playing instantly.
 *
 *   This is the key UX differentiator — while competitors show a loading
 *   spinner for 1-2 seconds, webinar.ai starts playing immediately.
 *
 * FRAME-PRECISE CUTTING:
 *   Uses re-encoding (not stream-copy) to cut at the exact frame boundary.
 *   Previously used `-c copy` which cut at GOP boundaries, causing the hook
 *   clip's actual duration to differ from the specified duration by up to
 *   1-2 seconds. Re-encoding guarantees the clip ends at exactly the
 *   requested timestamp.
 *
 * ARCHITECTURE:
 *   - Called by: video-processor.ts worker (render job handler, after stitching)
 *   - Depends on: commands.ts (FFmpeg execution), specs.ts (encoding params)
 *   - Input: The full stitched variant .mp4 + the hook segment's duration + spec
 *   - Output: A standalone .mp4 containing only the hook portion
 */

import { runFFmpeg } from "./commands";
import type { NormalizationSpec } from "./specs";

export async function extractHookClip(
  variantVideoPath: string,
  hookClipOutputPath: string,
  hookDurationMs: number,
  spec: NormalizationSpec
): Promise<void> {
  const durationSec = hookDurationMs / 1000;

  const args = [
    "-i",
    variantVideoPath,
    "-t",
    String(durationSec),
    // Re-encode for frame-precise cutting
    "-c:v",
    spec.videoCodec,
    "-preset",
    "fast",
    "-crf",
    String(spec.crf),
    "-profile:v",
    spec.profile,
    "-level",
    spec.level,
    "-pix_fmt",
    spec.pixelFormat,
    "-g",
    String(spec.fps * 2),
    "-keyint_min",
    String(spec.fps),
    "-maxrate",
    "5M",
    "-bufsize",
    "10M",
    "-c:a",
    spec.audioCodec,
    "-b:a",
    "96k",
    "-ar",
    String(spec.audioRate),
    "-ac",
    String(spec.audioChannels),
    "-threads",
    "4",
    "-movflags",
    "+faststart",
    "-y",
    hookClipOutputPath,
  ];

  console.log(`[extract-hook] Re-encoding ${durationSec}s hook clip (${spec.videoCodec} crf=${spec.crf})`);

  await runFFmpeg(args);
}
