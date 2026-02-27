/**
 * normalize.ts — Video normalization engine
 *
 * PURPOSE:
 *   Re-encodes any uploaded video segment to a standardized set of specs
 *   (resolution, frame rate, codec, audio format). This is THE critical step
 *   that makes seamless stitching possible.
 *
 * WHY NORMALIZE:
 *   Users will upload videos from different cameras, phones, screen recorders,
 *   etc. — all with wildly different specs. If we try to concatenate videos
 *   with mismatched specs, FFmpeg's concat demuxer fails or produces glitchy
 *   output (audio drift, visual artifacts, decoder errors).
 *
 *   By normalizing ONCE per segment, we pay the encoding cost upfront. Then
 *   ALL subsequent stitching operations use `-c copy` (stream-copy) which is
 *   essentially instant, regardless of how many combinations we generate.
 *
 *   Cost math: 3 hooks + 3 bodies + 3 CTAs = 9 normalizations (expensive).
 *              3×3×3 = 27 variant stitches (free, stream-copy).
 *              Without normalization: 27 full re-encodes. Much worse.
 *
 * EDGE CASES HANDLED:
 *   - No audio track → generates silent audio so concat doesn't fail
 *   - Non-16:9 aspect ratios → letterbox/pillarbox with black bars
 *   - Variable frame rate → forced to constant frame rate
 *   - Any input codec → re-encoded to H.264 for universal compatibility
 *
 * ARCHITECTURE:
 *   - Called by: video-processor.ts worker (normalize job handler)
 *   - Depends on: commands.ts (FFmpeg execution), ffprobe.ts (metadata), specs.ts (target spec)
 *   - Output: A normalized .mp4 file ready for stream-copy concatenation
 */

import { runFFmpeg } from "./commands";
import { probeVideo } from "./ffprobe";
import type { NormalizationSpec } from "./specs";
export async function normalizeVideo(
  inputPath: string,
  outputPath: string,
  spec: NormalizationSpec
): Promise<void> {
  const metadata = await probeVideo(inputPath);

  const args: string[] = [];

  // Input file
  args.push("-i", inputPath);

  // If no audio, generate silent audio track
  if (!metadata.has_audio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${spec.audioRate}:cl=${spec.audioChannels === 2 ? "stereo" : "mono"}`
    );
  }

  // Video filters: scale + pad + set SAR + force fps
  const videoFilter = [
    `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease`,
    `pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
    `fps=${spec.fps}`,
  ].join(",");

  args.push("-vf", videoFilter);

  // Video codec settings
  // Limit threads to prevent OOM on containers (Railway defaults to all host cores)
  args.push("-threads", "4");
  args.push(
    "-c:v",
    spec.videoCodec,
    "-preset",
    spec.preset,
    "-crf",
    String(spec.crf),
    "-profile:v",
    spec.profile,
    "-level",
    spec.level,
    "-pix_fmt",
    spec.pixelFormat,
    // Keyframe every 2 seconds — enables precise seeking in browsers.
    // Without this, FFmpeg uses large GOP sizes that make seeking sluggish
    // because the browser must decode from the nearest keyframe.
    "-g",
    String(spec.fps * 2),
    "-keyint_min",
    String(spec.fps),
    // Constrained bitrate prevents quality spikes that cause buffering.
    // CRF still controls average quality, but maxrate caps peaks.
    // 5Mbps max is generous for 1080p/30fps H.264 (typical avg is 2-3Mbps).
    "-maxrate",
    "5M",
    "-bufsize",
    "10M"
  );

  // Audio codec settings — 96k AAC is transparent for speech (VSL/webinar
  // content). Saves ~20% vs 128k with no audible difference for voice.
  args.push(
    "-c:a",
    spec.audioCodec,
    "-b:a",
    "96k",
    "-ar",
    String(spec.audioRate),
    "-ac",
    String(spec.audioChannels)
  );

  // Map streams
  args.push("-map", "0:v:0");
  if (metadata.has_audio) {
    args.push("-map", "0:a:0");
  } else {
    // Map the generated silent audio (input index 1)
    args.push("-map", "1:a:0", "-shortest");
  }

  // Output options
  args.push("-movflags", "+faststart", "-y", outputPath);

  await runFFmpeg(args);
}
