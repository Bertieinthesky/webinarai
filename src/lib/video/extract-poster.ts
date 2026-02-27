/**
 * extract-poster.ts — Poster frame extraction for instant visual loading
 *
 * Grabs a single frame from the variant video as a JPEG thumbnail.
 * This displays instantly in the player while the video buffers,
 * replacing the black rectangle viewers would otherwise see.
 *
 * Uses the first frame (time 0) since hooks are designed to be
 * visually engaging from frame one.
 */

import { runFFmpeg } from "./commands";

export async function extractPosterFrame(
  videoPath: string,
  posterOutputPath: string
): Promise<void> {
  const args = [
    "-i",
    videoPath,
    "-vframes",
    "1",
    "-q:v",
    "2", // High quality JPEG (scale 1-31, lower = better)
    "-y",
    posterOutputPath,
  ];

  await runFFmpeg(args);
}
