/**
 * ffprobe.ts — Video metadata inspection
 *
 * PURPOSE:
 *   Extracts technical metadata from uploaded video files using FFprobe.
 *   This information is used for:
 *     1. Storing original video specs in the database (for display in the dashboard)
 *     2. Determining if the video has an audio track (normalize.ts needs to know
 *        this to generate silent audio if missing)
 *     3. Getting the exact duration (used for hook clip extraction timing)
 *
 * ARCHITECTURE:
 *   - Called by: normalize.ts (to check for audio), video-processor.ts (to store metadata)
 *   - Depends on: commands.ts (FFprobe execution)
 *   - Returns: A typed VideoMetadata object with all relevant properties
 */

import { runFFprobe } from "./commands";

export interface VideoMetadata {
  duration_ms: number;
  width: number;
  height: number;
  fps: number;
  video_codec: string;
  audio_codec: string | null;
  audio_sample_rate: number | null;
  audio_channels: number | null;
  size_bytes: number;
  has_audio: boolean;
}

export async function probeVideo(inputPath: string): Promise<VideoMetadata> {
  const { stdout } = await runFFprobe([
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ]);

  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find(
    (s: Record<string, string>) => s.codec_type === "video"
  );
  const audioStream = data.streams?.find(
    (s: Record<string, string>) => s.codec_type === "audio"
  );

  if (!videoStream) {
    throw new Error("No video stream found in file");
  }

  // Parse frame rate (e.g., "30/1" or "30000/1001")
  const fpsStr = videoStream.r_frame_rate || "30/1";
  const [fpsNum, fpsDen] = fpsStr.split("/").map(Number);
  const fps = fpsDen ? fpsNum / fpsDen : fpsNum;

  const durationSec =
    parseFloat(videoStream.duration) ||
    parseFloat(data.format?.duration) ||
    0;

  return {
    duration_ms: Math.round(durationSec * 1000),
    width: parseInt(videoStream.width, 10),
    height: parseInt(videoStream.height, 10),
    fps: Math.round(fps * 100) / 100,
    video_codec: videoStream.codec_name,
    audio_codec: audioStream?.codec_name || null,
    audio_sample_rate: audioStream
      ? parseInt(audioStream.sample_rate, 10)
      : null,
    audio_channels: audioStream ? parseInt(audioStream.channels, 10) : null,
    size_bytes: parseInt(data.format?.size || "0", 10),
    has_audio: !!audioStream,
  };
}
