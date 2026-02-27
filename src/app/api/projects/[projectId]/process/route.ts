/**
 * /api/projects/[projectId]/process — Trigger video processing pipeline
 *
 * PURPOSE:
 *   This is the "big red button" that kicks off the entire video processing
 *   pipeline. When a user clicks "Process All Variants" in the dashboard,
 *   this endpoint:
 *     1. Validates the project has at least one hook, body, and CTA
 *     2. Generates all variant combinations (hook × body × cta)
 *     3. Creates variant records in the database (status: pending)
 *     4. Updates the project status to "processing"
 *     5. Enqueues normalization jobs for all segments
 *
 *   From there, the video-processor worker takes over:
 *     - Normalizes all segments
 *     - Automatically enqueues render jobs when normalization completes
 *     - Renders all variants and extracts hook clips
 *     - Marks the project as "ready" when all variants are done
 *
 * ARCHITECTURE:
 *   Dashboard → POST /api/projects/[id]/process
 *     → creates variant records + enqueues normalize jobs
 *     → video-processor worker picks up jobs from Redis
 *     → worker normalizes → stitches → extracts hooks → uploads to R2
 *     → project status becomes "ready" → embed player can serve variants
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCombinations } from "@/lib/variant/combinations";
import { enqueueNormalize, enqueueRender } from "@/lib/queue/jobs";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const admin = createAdminClient();

    // Verify project belongs to user
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return errorResponse("Project not found", 404);
    }

    const typedProject = project as Project;
    if (typedProject.status !== "draft") {
      return errorResponse("Project is already processing or complete");
    }

    // Get all uploaded segments
    const { data: segments, error: segError } = await admin
      .from("segments")
      .select("*")
      .eq("project_id", projectId)
      .in("status", ["uploaded", "normalized"]);

    if (segError || !segments) {
      return errorResponse("Failed to fetch segments");
    }

    const typedSegments = segments as Segment[];

    // Validate we have at least one of each type
    const hooks = typedSegments.filter((s) => s.type === "hook");
    const bodies = typedSegments.filter((s) => s.type === "body");
    const ctas = typedSegments.filter((s) => s.type === "cta");

    if (!hooks.length || !bodies.length || !ctas.length) {
      return errorResponse(
        `Need at least one of each segment type. Got: ${hooks.length} hooks, ${bodies.length} bodies, ${ctas.length} CTAs`
      );
    }

    // Generate all variant combinations and create records
    const combinations = generateCombinations(
      typedSegments.map((s) => ({
        id: s.id,
        type: s.type,
        label: s.label,
        sort_order: s.sort_order,
      }))
    );

    // Create variant records
    const variantInserts = combinations.map((combo) => ({
      project_id: projectId,
      hook_segment_id: combo.hook.id,
      body_segment_id: combo.body.id,
      cta_segment_id: combo.cta.id,
      variant_code: combo.variantCode,
      status: "pending" as const,
    }));

    const { error: variantError } = await admin
      .from("variants")
      .insert(variantInserts);

    if (variantError) {
      return errorResponse(`Failed to create variants: ${variantError.message}`);
    }

    // Update project status
    await admin
      .from("projects")
      .update({ status: "processing" })
      .eq("id", projectId);

    // Enqueue normalization jobs for segments that aren't already normalized
    const toNormalize = typedSegments.filter((s) => s.status === "uploaded");
    for (const seg of toNormalize) {
      await admin
        .from("segments")
        .update({ status: "normalizing" })
        .eq("id", seg.id);

      // Create processing job record
      await admin.from("processing_jobs").insert({
        project_id: projectId,
        job_type: "normalize",
        target_id: seg.id,
        status: "queued",
      });

      if (!seg.original_storage_key) {
        return errorResponse(`Segment ${seg.label || seg.id} is missing its uploaded file`);
      }

      await enqueueNormalize({
        projectId,
        segmentId: seg.id,
        originalStorageKey: seg.original_storage_key,
      });
    }

    // If all segments are already normalized, enqueue render jobs directly
    // (normally the worker does this after the last normalize job completes,
    // but on retry all segments may already be normalized)
    if (toNormalize.length === 0) {
      const segmentMap = new Map(typedSegments.map((s) => [s.id, s]));
      const { data: newVariants } = await admin
        .from("variants")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "pending");

      if (newVariants) {
        const typedVariants = newVariants as Variant[];
        for (const v of typedVariants) {
          const hook = segmentMap.get(v.hook_segment_id);
          const body = segmentMap.get(v.body_segment_id);
          const cta = segmentMap.get(v.cta_segment_id);

          if (
            !hook?.normalized_storage_key ||
            !body?.normalized_storage_key ||
            !cta?.normalized_storage_key ||
            !hook.normalized_duration_ms
          ) {
            continue;
          }

          await admin.from("processing_jobs").insert({
            project_id: projectId,
            job_type: "render",
            target_id: v.id,
            status: "queued",
          });

          await enqueueRender({
            projectId,
            variantId: v.id,
            hookSegmentId: v.hook_segment_id,
            bodySegmentId: v.body_segment_id,
            ctaSegmentId: v.cta_segment_id,
            hookNormalizedKey: hook.normalized_storage_key,
            bodyNormalizedKey: body.normalized_storage_key,
            ctaNormalizedKey: cta.normalized_storage_key,
            hookDurationMs: hook.normalized_duration_ms,
          });
        }
      }
    }

    return NextResponse.json({
      message: "Processing started",
      segmentsToNormalize: toNormalize.length,
      variantsToRender: combinations.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
