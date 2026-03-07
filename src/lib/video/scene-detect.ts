/**
 * scene-detect.ts — Detect scene changes and silence gaps using FFmpeg
 *
 * Uses FFmpeg's scene detection filter to find natural split points.
 * The `select='gt(scene,T)'` filter computes a 0-1 scene change score
 * for each frame. Frames exceeding the threshold T are reported via showinfo.
 *
 * Also supports silence detection via the silencedetect audio filter.
 *
 * USED BY: video-processor.ts (processAnalyze worker)
 * DEPENDS ON: commands.ts (runFFmpeg wrapper)
 */

import { runFFmpeg } from "./commands";

export interface SceneChangePoint {
  timeMs: number;
  confidence: number;
  type: "scene_change" | "silence";
}

/**
 * Detect scene changes using FFmpeg's scene detection filter.
 *
 * Runs: ffmpeg -i input -vf "select='gt(scene,T)',showinfo" -f null -
 * Parses stderr for pts_time values from the showinfo filter output.
 *
 * @param inputPath Path to the source video file
 * @param threshold Scene change threshold (0-1). Default 0.3.
 *   Lower = more detections, higher = only major changes.
 * @returns Array of detected scene change points sorted by time
 */
export async function detectSceneChanges(
  inputPath: string,
  threshold: number = 0.3
): Promise<SceneChangePoint[]> {
  // showinfo outputs frame metadata to stderr for each selected frame
  const { stderr } = await runFFmpeg(
    [
      "-i", inputPath,
      "-vf", `select='gt(scene\\,${threshold})',showinfo`,
      "-f", "null",
      "-",
    ],
    600_000 // 10 min timeout (read-only pass, no re-encoding)
  );

  const points: SceneChangePoint[] = [];
  const lines = stderr.split("\n");

  for (const line of lines) {
    // showinfo outputs lines like: [Parsed_showinfo_1 ...] n:5 pts:12345 pts_time:1.234 ...
    const ptsMatch = line.match(/pts_time:\s*(\d+\.?\d*)/);
    if (ptsMatch) {
      const timeSec = parseFloat(ptsMatch[1]);
      points.push({
        timeMs: Math.round(timeSec * 1000),
        confidence: threshold, // all detections exceed the threshold
        type: "scene_change",
      });
    }
  }

  return points;
}

/**
 * Detect silence gaps using FFmpeg's silencedetect filter.
 *
 * Runs: ffmpeg -i input -af "silencedetect=noise=NdB:d=D" -f null -
 * Parses stderr for silence_end timestamps — the end of each silence gap
 * is a natural split point (transition from silence to sound).
 *
 * @param inputPath Path to the source video file
 * @param noiseDb Noise floor in dB (default -30). Audio below this = silence.
 * @param durationSec Minimum silence duration in seconds (default 0.5)
 * @returns Array of detected silence boundary points sorted by time
 */
export async function detectSilence(
  inputPath: string,
  noiseDb: number = -30,
  durationSec: number = 0.5
): Promise<SceneChangePoint[]> {
  const { stderr } = await runFFmpeg(
    [
      "-i", inputPath,
      "-af", `silencedetect=noise=${noiseDb}dB:d=${durationSec}`,
      "-f", "null",
      "-",
    ],
    600_000
  );

  const points: SceneChangePoint[] = [];
  const lines = stderr.split("\n");

  for (const line of lines) {
    // silencedetect outputs: [silencedetect ...] silence_end: 1.234 | silence_duration: 0.567
    const match = line.match(/silence_end:\s*(\d+\.?\d*)/);
    if (match) {
      const timeSec = parseFloat(match[1]);
      points.push({
        timeMs: Math.round(timeSec * 1000),
        confidence: 0.8,
        type: "silence",
      });
    }
  }

  return points;
}

/**
 * Deduplicate nearby points — if two points are within `thresholdMs` of
 * each other, keep the one with higher confidence.
 */
export function deduplicatePoints(
  points: SceneChangePoint[],
  thresholdMs: number = 1000
): SceneChangePoint[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.timeMs - b.timeMs);
  const result: SceneChangePoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];

    if (curr.timeMs - prev.timeMs < thresholdMs) {
      // Keep the higher-confidence one
      if (curr.confidence > prev.confidence) {
        result[result.length - 1] = curr;
      }
    } else {
      result.push(curr);
    }
  }

  return result;
}
