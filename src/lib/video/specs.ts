/**
 * specs.ts — Video normalization target specifications
 *
 * PURPOSE:
 *   Defines the target specs that all uploaded segments are normalized to.
 *   Every segment MUST be re-encoded to identical specs so that FFmpeg's
 *   concat demuxer can stitch them with stream-copy (no re-encoding).
 *
 * DEFAULT SPEC:
 *   1920x1080, 30fps, H.264 High Profile 4.1, AAC 44.1kHz stereo, yuv420p
 *   CRF 23 (good quality/size balance), medium preset
 *
 * WHY THESE VALUES:
 *   - 1080p/30fps: Standard web video quality
 *   - H.264 High 4.1: Maximum browser compatibility
 *   - yuv420p: Required for web playback (vs yuv444p which some devices reject)
 *   - AAC stereo 44.1kHz: Universal audio compatibility
 *   - CRF 23: Good quality without bloating file size
 *
 * CUSTOMIZATION:
 *   Each project stores its own target specs in the database. The
 *   `specFromProject` function converts project fields to a NormalizationSpec.
 *   This allows future support for different output qualities per project.
 *
 * USED BY:
 *   - video-processor.ts worker (reads project specs for normalization)
 *   - normalize.ts (uses spec to build FFmpeg command)
 */

export interface NormalizationSpec {
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  audioRate: number;
  audioChannels: number;
  pixelFormat: string;
  crf: number;
  preset: string;
  profile: string;
  level: string;
}

export const DEFAULT_SPEC: NormalizationSpec = {
  width: 1920,
  height: 1080,
  fps: 30,
  videoCodec: "libx264",
  audioCodec: "aac",
  audioRate: 44100,
  audioChannels: 2,
  pixelFormat: "yuv420p",
  crf: 24,
  preset: "medium",
  profile: "high",
  level: "4.1",
};

export function specFromProject(project: {
  target_width: number;
  target_height: number;
  target_fps: number;
  target_video_codec: string;
  target_audio_codec: string;
  target_audio_rate: number;
  target_pixel_format: string;
}): NormalizationSpec {
  return {
    ...DEFAULT_SPEC,
    width: project.target_width,
    height: project.target_height,
    fps: project.target_fps,
    videoCodec: project.target_video_codec,
    audioCodec: project.target_audio_codec,
    audioRate: project.target_audio_rate,
    pixelFormat: project.target_pixel_format,
  };
}
