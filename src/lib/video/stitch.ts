/**
 * stitch.ts — Video segment concatenation
 *
 * PURPOSE:
 *   Joins multiple normalized video segments (hook + body + CTA) into a single
 *   continuous video file. This is how each variant combination gets created.
 *
 * HOW IT WORKS:
 *   Uses FFmpeg's "concat demuxer" — a method that reads a text file listing
 *   the input files, then muxes them together without re-encoding (`-c copy`).
 *   This is possible ONLY because all segments have been normalized to identical
 *   specs (same codec, resolution, frame rate, audio format). If they weren't
 *   normalized, this would produce glitchy output.
 *
 * PERFORMANCE:
 *   Since we're doing stream-copy (no re-encoding), stitching is nearly instant
 *   regardless of video length. Stitching a 60-minute variant takes < 2 seconds.
 *   This is why the normalize-then-concat architecture is so powerful: the
 *   expensive work (encoding) happens once per segment, and the combinatorial
 *   work (stitching N variants) is essentially free.
 *
 * ARCHITECTURE:
 *   - Called by: video-processor.ts worker (render job handler)
 *   - Depends on: commands.ts (FFmpeg execution)
 *   - Input: Array of normalized .mp4 file paths (in playback order)
 *   - Output: A single .mp4 file containing all segments concatenated
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import { runFFmpeg } from "./commands";
export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
  workDir: string
): Promise<void> {
  // Create concat list file
  const concatListPath = join(workDir, "concat_list.txt");
  const concatContent = segmentPaths
    .map((p) => `file '${p.replace(/\\/g, "/")}'`)
    .join("\n");
  await writeFile(concatListPath, concatContent, "utf-8");

  const args = [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c",
    "copy",
    // Fix timestamp discontinuities at segment boundaries that cause
    // brief loading spinners in browser video players
    "-fflags",
    "+genpts",
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];

  await runFFmpeg(args);
}
