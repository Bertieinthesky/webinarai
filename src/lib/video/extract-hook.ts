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
 * PERFORMANCE:
 *   Uses `-c copy` (stream-copy, no re-encoding) so extraction is near-instant.
 *   A 15-second hook from a 30-minute video takes < 1 second to extract.
 *
 * ARCHITECTURE:
 *   - Called by: video-processor.ts worker (render job handler, after stitching)
 *   - Depends on: commands.ts (FFmpeg execution)
 *   - Input: The full stitched variant .mp4 + the hook segment's duration
 *   - Output: A standalone .mp4 containing only the hook portion
 */

import { runFFmpeg } from "./commands";
export async function extractHookClip(
  variantVideoPath: string,
  hookClipOutputPath: string,
  hookDurationMs: number
): Promise<void> {
  const durationSec = hookDurationMs / 1000;

  const args = [
    "-i",
    variantVideoPath,
    "-t",
    String(durationSec),
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    hookClipOutputPath,
  ];

  await runFFmpeg(args);
}
