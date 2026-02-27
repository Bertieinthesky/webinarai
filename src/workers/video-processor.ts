/**
 * video-processor.ts — Background video processing worker
 *
 * PURPOSE:
 *   This is the engine that turns uploaded video segments into playable,
 *   pre-rendered variant combinations. It runs as a SEPARATE process from
 *   the Next.js application and communicates via Redis-backed BullMQ queues.
 *
 * WHY A SEPARATE PROCESS:
 *   FFmpeg video processing is CPU-intensive and can take minutes for long
 *   videos. Serverless functions (Vercel, Lambda) have ~10-second timeouts,
 *   no persistent filesystem, and cold starts. A dedicated worker process
 *   gives us: persistent disk for temp files, unlimited execution time,
 *   consistent CPU, and concurrent job processing.
 *
 * JOB TYPES:
 *   1. NORMALIZE — Re-encode an uploaded segment to standard specs
 *      - Downloads original from R2 → probes metadata → runs FFmpeg normalize
 *      - Uploads normalized file back to R2
 *      - When ALL segments for a project are normalized, automatically
 *        enqueues render jobs for every variant combination
 *
 *   2. RENDER — Stitch 3 normalized segments into a complete variant video
 *      - Downloads hook + body + CTA from R2
 *      - Stitches them via FFmpeg concat (stream-copy, near-instant)
 *      - Extracts the hook clip for instant-playback preloading
 *      - Uploads both to R2
 *      - When ALL variants for a project are rendered, marks project as "ready"
 *
 * CONCURRENCY:
 *   - Normalize: 2 concurrent jobs (CPU-intensive, each uses ~200-400MB RAM)
 *   - Render: 4 concurrent jobs (stream-copy is I/O-bound, very lightweight)
 *
 * ERROR HANDLING:
 *   - BullMQ retries failed jobs 3 times with exponential backoff
 *   - Failed jobs are tracked in the processing_jobs table with error messages
 *   - Temp files are always cleaned up (even on failure) via finally blocks
 *
 * HOW TO RUN:
 *   Development:  npm run worker (or: npx tsx src/workers/video-processor.ts)
 *   Production:   Deploy to a dedicated VM (Railway, Render, EC2) with FFmpeg installed
 *
 * ARCHITECTURE:
 *   Next.js API (POST /api/projects/[id]/process)
 *     → enqueues normalize jobs to Redis
 *     → this worker picks them up
 *     → normalizes all segments
 *     → automatically enqueues render jobs
 *     → renders all variants
 *     → marks project as "ready"
 *     → embed player can now serve variants
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Worker, Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { normalizeVideo } from "../lib/video/normalize";
import { stitchSegments } from "../lib/video/stitch";
import { extractHookClip } from "../lib/video/extract-hook";
import { probeVideo } from "../lib/video/ffprobe";
import { DEFAULT_SPEC } from "../lib/video/specs";
import { extractPosterFrame } from "../lib/video/extract-poster";
import { normalizedSegmentKey, variantVideoKey, variantHookClipKey, variantPosterKey } from "../lib/storage/keys";
import { getRedisConnection } from "../lib/queue/connection";
import type { NormalizeJobData, RenderJobData } from "../lib/queue/types";
import type { Database } from "../lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

// Initialize clients
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

// ──────────────────────────────────────────
// Helper: Download from R2 to local file
// ──────────────────────────────────────────

async function downloadFromR2(key: string, localPath: string): Promise<void> {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  await writeFile(localPath, Buffer.concat(chunks));
}

// ──────────────────────────────────────────
// Helper: Upload local file to R2
// ──────────────────────────────────────────

async function uploadToR2(
  localPath: string,
  key: string,
  contentType = "video/mp4"
): Promise<number> {
  const buffer = await readFile(localPath);
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return buffer.length;
}

// ──────────────────────────────────────────
// NORMALIZE WORKER
// ──────────────────────────────────────────

async function processNormalize(job: Job<NormalizeJobData>) {
  const { projectId, segmentId, originalStorageKey } = job.data;
  const workDir = join(tmpdir(), `wai-normalize-${job.id}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await supabase
      .from("processing_jobs")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("target_id", segmentId)
      .eq("job_type", "normalize");

    await job.updateProgress(10);

    // Download original
    const inputPath = join(workDir, "input.mp4");
    console.log(`[normalize] Downloading ${originalStorageKey}...`);
    await downloadFromR2(originalStorageKey, inputPath);
    await job.updateProgress(20);

    // Probe metadata
    console.log(`[normalize] Probing ${segmentId}...`);
    const metadata = await probeVideo(inputPath);

    // Update segment with original metadata
    await supabase
      .from("segments")
      .update({
        original_duration_ms: metadata.duration_ms,
        original_width: metadata.width,
        original_height: metadata.height,
        original_fps: metadata.fps,
        original_codec: metadata.video_codec,
      })
      .eq("id", segmentId);

    await job.updateProgress(30);

    // Get project specs
    const { data: rawProject } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const project = rawProject as Project | null;
    const spec = project
      ? {
          ...DEFAULT_SPEC,
          width: project.target_width,
          height: project.target_height,
          fps: project.target_fps,
          videoCodec: project.target_video_codec,
          audioCodec: project.target_audio_codec,
          audioRate: project.target_audio_rate,
          pixelFormat: project.target_pixel_format,
        }
      : DEFAULT_SPEC;

    // Normalize
    const outputPath = join(workDir, "normalized.mp4");
    console.log(`[normalize] Normalizing ${segmentId}...`);
    await normalizeVideo(inputPath, outputPath, spec);
    await job.updateProgress(70);

    // Probe normalized output
    const normalizedMeta = await probeVideo(outputPath);

    // Upload normalized
    const storageKey = normalizedSegmentKey(projectId, segmentId);
    console.log(`[normalize] Uploading normalized to ${storageKey}...`);
    const sizeBytes = await uploadToR2(outputPath, storageKey);
    await job.updateProgress(90);

    // Update segment record
    await supabase
      .from("segments")
      .update({
        status: "normalized",
        normalized_storage_key: storageKey,
        normalized_size_bytes: sizeBytes,
        normalized_duration_ms: normalizedMeta.duration_ms,
      })
      .eq("id", segmentId);

    // Update processing job
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("target_id", segmentId)
      .eq("job_type", "normalize");

    await job.updateProgress(100);

    // Check if ALL segments for this project are normalized
    await checkAndEnqueueRenders(projectId);

    console.log(`[normalize] Done: ${segmentId}`);
  } catch (error) {
    console.error(`[normalize] Failed: ${segmentId}`, error);

    await supabase
      .from("segments")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", segmentId);

    await supabase
      .from("processing_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("target_id", segmentId)
      .eq("job_type", "normalize");

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ──────────────────────────────────────────
// Check if all segments normalized → enqueue renders
// ──────────────────────────────────────────

async function checkAndEnqueueRenders(projectId: string) {
  const { data: rawSegments } = await supabase
    .from("segments")
    .select("*")
    .eq("project_id", projectId);

  if (!rawSegments) return;
  const segments = rawSegments as Segment[];

  const allNormalized = segments.every((s) => s.status === "normalized");
  if (!allNormalized) return;

  console.log(`[normalize] All segments normalized for project ${projectId}. Enqueueing renders...`);

  // Get pending variants
  const { data: rawVariants } = await supabase
    .from("variants")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending");

  if (!rawVariants || rawVariants.length === 0) return;
  const variants = rawVariants as Variant[];

  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  // Import render queue dynamically to avoid circular deps at startup
  const { Queue } = await import("bullmq");
  const renderQueue = new Queue("render", { connection: getRedisConnection() });

  for (const variant of variants) {
    const hook = segmentMap.get(variant.hook_segment_id);
    const body = segmentMap.get(variant.body_segment_id);
    const cta = segmentMap.get(variant.cta_segment_id);

    if (!hook?.normalized_storage_key || !body?.normalized_storage_key || !cta?.normalized_storage_key) {
      console.error(`[render] Missing normalized keys for variant ${variant.id}`);
      continue;
    }

    // Create processing job record
    await supabase.from("processing_jobs").insert({
      project_id: projectId,
      job_type: "render",
      target_id: variant.id,
      status: "queued",
    });

    await renderQueue.add(`render-${variant.id}`, {
      projectId,
      variantId: variant.id,
      hookSegmentId: variant.hook_segment_id,
      bodySegmentId: variant.body_segment_id,
      ctaSegmentId: variant.cta_segment_id,
      hookNormalizedKey: hook.normalized_storage_key,
      bodyNormalizedKey: body.normalized_storage_key,
      ctaNormalizedKey: cta.normalized_storage_key,
      hookDurationMs: hook.normalized_duration_ms!,
    } satisfies RenderJobData);
  }

  await renderQueue.close();
}

// ──────────────────────────────────────────
// RENDER WORKER
// ──────────────────────────────────────────

async function processRender(job: Job<RenderJobData>) {
  const {
    projectId,
    variantId,
    hookNormalizedKey,
    bodyNormalizedKey,
    ctaNormalizedKey,
    hookDurationMs,
  } = job.data;
  const workDir = join(tmpdir(), `wai-render-${job.id}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update status
    await supabase
      .from("variants")
      .update({ status: "rendering" })
      .eq("id", variantId);

    await supabase
      .from("processing_jobs")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("target_id", variantId)
      .eq("job_type", "render");

    await job.updateProgress(10);

    // Download all three normalized segments
    const hookPath = join(workDir, "hook.mp4");
    const bodyPath = join(workDir, "body.mp4");
    const ctaPath = join(workDir, "cta.mp4");

    console.log(`[render] Downloading segments for variant ${variantId}...`);
    await Promise.all([
      downloadFromR2(hookNormalizedKey, hookPath),
      downloadFromR2(bodyNormalizedKey, bodyPath),
      downloadFromR2(ctaNormalizedKey, ctaPath),
    ]);
    await job.updateProgress(30);

    // Stitch segments
    const variantPath = join(workDir, "variant.mp4");
    console.log(`[render] Stitching variant ${variantId}...`);
    await stitchSegments([hookPath, bodyPath, ctaPath], variantPath, workDir);
    await job.updateProgress(50);

    // Extract hook clip + poster frame
    const hookClipPath = join(workDir, "hook-clip.mp4");
    const posterPath = join(workDir, "poster.jpg");
    console.log(`[render] Extracting hook clip for variant ${variantId}...`);
    await extractHookClip(variantPath, hookClipPath, hookDurationMs);
    console.log(`[render] Extracting poster frame for variant ${variantId}...`);
    await extractPosterFrame(variantPath, posterPath);
    await job.updateProgress(60);

    // Probe the rendered variant
    const variantMeta = await probeVideo(variantPath);
    const hookClipMeta = await probeVideo(hookClipPath);

    // Upload variant video
    const videoKey = variantVideoKey(projectId, variantId);
    console.log(`[render] Uploading variant video to ${videoKey}...`);
    const videoSize = await uploadToR2(variantPath, videoKey);
    await job.updateProgress(75);

    // Upload hook clip
    const hookClipKey = variantHookClipKey(projectId, variantId);
    console.log(`[render] Uploading hook clip to ${hookClipKey}...`);
    const hookClipSize = await uploadToR2(hookClipPath, hookClipKey);
    await job.updateProgress(85);

    // Upload poster frame
    const posterKey = variantPosterKey(projectId, variantId);
    console.log(`[render] Uploading poster to ${posterKey}...`);
    await uploadToR2(posterPath, posterKey, "image/jpeg");
    await job.updateProgress(90);

    // Update variant record
    await supabase
      .from("variants")
      .update({
        status: "rendered",
        video_storage_key: videoKey,
        video_size_bytes: videoSize,
        video_duration_ms: variantMeta.duration_ms,
        hook_clip_storage_key: hookClipKey,
        hook_clip_size_bytes: hookClipSize,
        hook_clip_duration_ms: hookClipMeta.duration_ms,
        hook_end_time_ms: hookDurationMs,
      })
      .eq("id", variantId);

    // Update processing job
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("target_id", variantId)
      .eq("job_type", "render");

    await job.updateProgress(100);

    // Check if ALL variants rendered → mark project ready
    await checkProjectComplete(projectId);

    console.log(`[render] Done: variant ${variantId}`);
  } catch (error) {
    console.error(`[render] Failed: variant ${variantId}`, error);

    await supabase
      .from("variants")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", variantId);

    await supabase
      .from("processing_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("target_id", variantId)
      .eq("job_type", "render");

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ──────────────────────────────────────────
// Check if all variants rendered → project ready
// ──────────────────────────────────────────

async function checkProjectComplete(projectId: string) {
  const { data: rawVariants } = await supabase
    .from("variants")
    .select("status")
    .eq("project_id", projectId);

  if (!rawVariants) return;
  const variants = rawVariants as Pick<Variant, "status">[];

  const allRendered = variants.every((v) => v.status === "rendered");
  if (allRendered) {
    console.log(`[render] All variants rendered for project ${projectId}. Marking ready.`);
    await supabase
      .from("projects")
      .update({ status: "ready" })
      .eq("id", projectId);
  }
}

// ──────────────────────────────────────────
// Start workers
// ──────────────────────────────────────────

console.log("Starting webinar.ai video processing workers...");

const normalizeWorker = new Worker("normalize", processNormalize, {
  connection: getRedisConnection(),
  concurrency: 2,
});

const renderWorker = new Worker("render", processRender, {
  connection: getRedisConnection(),
  concurrency: 4,
});

normalizeWorker.on("completed", (job) => {
  console.log(`[normalize] Job ${job.id} completed`);
});

normalizeWorker.on("failed", (job, err) => {
  console.error(`[normalize] Job ${job?.id} failed:`, err.message);
});

renderWorker.on("completed", (job) => {
  console.log(`[render] Job ${job.id} completed`);
});

renderWorker.on("failed", (job, err) => {
  console.error(`[render] Job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await normalizeWorker.close();
  await renderWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down workers...");
  await normalizeWorker.close();
  await renderWorker.close();
  process.exit(0);
});

console.log("Workers running. Waiting for jobs...");
