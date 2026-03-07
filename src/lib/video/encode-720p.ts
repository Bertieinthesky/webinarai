/**
 * encode-720p.ts — 720p mobile rendition encoder
 *
 * PURPOSE:
 *   Re-encodes a 1080p variant video at 720p (1280x720) for mobile devices.
 *   720p is visually identical to 1080p on phone screens but 40-60% smaller,
 *   meaning faster load times and less bandwidth on cellular connections.
 *
 * WHY NOT JUST SERVE 1080p:
 *   - Phone screens are 375-428px CSS width (750-856px physical)
 *   - 1080p has 2.5x more pixels than a phone can display
 *   - Extra pixels = wasted bandwidth + slower decode + more battery drain
 *   - 720p on a phone is perceptually identical to 1080p
 *
 * PERFORMANCE:
 *   This IS a re-encode (not stream-copy), so it takes real time.
 *   A 30-minute video at medium preset: ~3-5 minutes on a decent server.
 *   Runs as a best-effort post-render step — if it fails, mobile falls
 *   back to 1080p. Never blocks the main render pipeline.
 *
 * USED BY:
 *   - video-processor.ts (render step, after main render completes)
 *   - page.tsx (serves 720p URL to mobile viewers via UA detection)
 */

import { runFFmpeg } from "./commands";

export async function encode720p(
  inputPath: string,
  outputPath: string,
  crf: number = 24
): Promise<void> {
  const videoFilter = [
    "scale=1280:720:force_original_aspect_ratio=decrease",
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    "setsar=1",
  ].join(",");

  await runFFmpeg(
    [
      "-i",
      inputPath,
      "-vf",
      videoFilter,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(crf),
      "-profile:v",
      "high",
      "-level",
      "4.0",
      "-pix_fmt",
      "yuv420p",
      "-maxrate",
      "3M",
      "-bufsize",
      "6M",
      "-g",
      "60",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ],
    600_000 // 10 min timeout
  );
}
