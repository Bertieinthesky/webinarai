/**
 * stitch.ts — Video segment concatenation
 *
 * PURPOSE:
 *   Joins multiple normalized video segments (hook + body + CTA) into a single
 *   continuous video file. This is how each variant combination gets created.
 *
 * HOW IT WORKS:
 *   Uses FFmpeg's concat FILTER to decode all input segments and re-encode them
 *   as a single continuous stream. This guarantees seamless playback at segment
 *   boundaries — no PTS discontinuities, no GOP alignment issues, no audio gaps.
 *
 *   Previous approach used the concat DEMUXER with -c copy (stream-copy), which
 *   was nearly instant but produced PTS discontinuities at segment joins. These
 *   caused browsers to stutter/replay ~1 second at each transition point.
 *
 * PERFORMANCE:
 *   Re-encoding takes ~3-5 minutes for a 30-minute video (vs ~2 seconds for
 *   stream-copy). This is acceptable because seamless playback is the #1
 *   priority. Uses -preset fast to minimize encoding time while maintaining
 *   quality (input segments are already high-quality normalized content).
 *
 * ARCHITECTURE:
 *   - Called by: video-processor.ts worker (render job handler)
 *   - Depends on: commands.ts (FFmpeg execution), specs.ts (encoding params)
 *   - Input: Array of normalized .mp4 file paths (in playback order) + spec
 *   - Output: A single .mp4 file containing all segments seamlessly joined
 */

import { runFFmpeg } from "./commands";
import type { NormalizationSpec } from "./specs";

export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
  _workDir: string,
  spec: NormalizationSpec
): Promise<void> {
  // Build inputs and filter_complex for N segments
  const inputs: string[] = [];
  const filterParts: string[] = [];

  for (let i = 0; i < segmentPaths.length; i++) {
    inputs.push("-i", segmentPaths[i]);
    filterParts.push(`[${i}:v][${i}:a]`);
  }

  const filterComplex = `${filterParts.join("")}concat=n=${segmentPaths.length}:v=1:a=1[v][a]`;

  const args = [
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-map",
    "[a]",
    // Video encoding — same quality target as normalization
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
    // Audio encoding
    "-c:a",
    spec.audioCodec,
    "-b:a",
    "96k",
    "-ar",
    String(spec.audioRate),
    "-ac",
    String(spec.audioChannels),
    // Output
    "-threads",
    "4",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];

  await runFFmpeg(args);
}
