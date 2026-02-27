/**
 * commands.ts — Low-level FFmpeg/FFprobe execution wrapper
 *
 * PURPOSE:
 *   Provides a thin, typed wrapper around FFmpeg and FFprobe binary execution.
 *   Every video operation in webinar.ai (normalization, stitching, hook extraction)
 *   ultimately calls through this module.
 *
 * WHY NOT fluent-ffmpeg:
 *   fluent-ffmpeg wraps FFmpeg in a fluent API, but it obscures the actual
 *   command being built, makes debugging harder (you can't see the exact args),
 *   and has inconsistent maintenance. For production video processing, we want
 *   full control over the exact FFmpeg arguments — deterministic, debuggable,
 *   and testable. This thin wrapper using child_process.execFile gives us that.
 *
 * ARCHITECTURE:
 *   - Used by: normalize.ts, stitch.ts, extract-hook.ts, ffprobe.ts
 *   - Runs in: The video-processor worker process (NOT the Next.js server)
 *   - FFmpeg path is configurable via FFMPEG_PATH env var (important on Windows
 *     where the binary may not be on the system PATH)
 *
 * CAPABILITIES:
 *   - Execute any FFmpeg command with typed arguments
 *   - Execute any FFprobe command for video metadata inspection
 *   - Configurable timeout (default 10 minutes for long encodes)
 *   - Proper error handling with stderr capture for debugging
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Resolve the FFmpeg/FFprobe binary paths lazily.
 * Uses lazy evaluation so env vars loaded via dotenv are available.
 * Falls back to "ffmpeg"/"ffprobe" (assumes they're on PATH) if FFMPEG_PATH isn't set.
 */
function getFFmpegPath(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function getFFprobePath(): string {
  const ffmpegPath = process.env.FFMPEG_PATH;
  if (!ffmpegPath) return "ffprobe";
  return ffmpegPath.replace("ffmpeg.exe", "ffprobe.exe").replace(/ffmpeg$/, "ffprobe");
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute an FFmpeg command with the given arguments.
 *
 * @param args - Array of CLI arguments (e.g., ["-i", "input.mp4", "-c:v", "libx264", "output.mp4"])
 * @param timeoutMs - Maximum execution time in milliseconds. Defaults to 30 minutes.
 *                    Normalization of a 30-minute VSL at 1080p typically takes 5-15 minutes.
 *                    Longer webinars (60-90 min) can take 15-25 minutes.
 * @returns stdout and stderr from the FFmpeg process
 * @throws Error with the full stderr output if the command fails
 */
export async function runFFmpeg(
  args: string[],
  timeoutMs = 1_800_000
): Promise<ExecResult> {
  try {
    const result = await execFileAsync(getFFmpegPath(), args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer — FFmpeg can produce verbose output
      timeout: timeoutMs,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string; code?: number };
    throw new Error(
      `FFmpeg failed: ${err.message}\nstderr: ${err.stderr || "N/A"}`
    );
  }
}

/**
 * Execute an FFprobe command to inspect video file metadata.
 *
 * @param args - Array of CLI arguments (typically includes -print_format json -show_streams)
 * @returns stdout (JSON metadata) and stderr from the FFprobe process
 * @throws Error with stderr if the probe fails (e.g., corrupted file, unsupported format)
 */
export async function runFFprobe(args: string[]): Promise<ExecResult> {
  try {
    const result = await execFileAsync(getFFprobePath(), args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000, // 30 seconds — probing should be near-instant
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string };
    throw new Error(
      `FFprobe failed: ${err.message}\nstderr: ${err.stderr || "N/A"}`
    );
  }
}
