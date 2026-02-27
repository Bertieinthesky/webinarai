/**
 * /api/projects/[projectId]/segments — Segment CRUD + upload initiation
 *
 * PURPOSE:
 *   Manages video segment records and initiates the upload flow.
 *
 *   GET: Lists all segments for a project (hooks, bodies, CTAs)
 *
 *   POST: Creates a new segment record AND returns a presigned upload URL.
 *   The upload flow works like this:
 *     1. Client sends POST with metadata (type, label, filename, size)
 *     2. Server creates the segment record in the database (status: "uploading")
 *     3. Server generates a presigned PUT URL for Cloudflare R2
 *     4. Server returns both the segment record AND the upload URL
 *     5. Client uploads the file directly to R2 using the presigned URL
 *        (this is a browser-to-R2 direct upload — the file never touches our server)
 *     6. Client sends PATCH to update segment status to "uploaded"
 *
 *   This approach is efficient because large video files go directly to storage
 *   without passing through our API server (which would be a bottleneck).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPresignedUploadUrl } from "@/lib/storage/r2";
import { originalSegmentKey } from "@/lib/storage/keys";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import { z } from "zod";
import { randomUUID } from "crypto";

const createSegmentSchema = z.object({
  type: z.enum(["hook", "body", "cta"]),
  label: z.string().min(1).max(100),
  filename: z.string().min(1),
  size: z.number().positive(),
  contentType: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("segments")
      .select("*")
      .eq("project_id", projectId)
      .order("type")
      .order("sort_order");

    if (error) return errorResponse(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const parsed = createSegmentSchema.parse(body);

    const supabase = createAdminClient();

    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return errorResponse("Project not found", 404);
    }

    // Get sort order (next in sequence for this type)
    const { count } = await supabase
      .from("segments")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("type", parsed.type);

    const segmentId = randomUUID();
    const ext = parsed.filename.includes(".")
      ? `.${parsed.filename.split(".").pop()}`
      : ".mp4";
    const storageKey = originalSegmentKey(projectId, segmentId, ext);

    // Create segment record
    const { data: segment, error: insertError } = await supabase
      .from("segments")
      .insert({
        id: segmentId,
        project_id: projectId,
        type: parsed.type,
        label: parsed.label,
        sort_order: (count || 0),
        original_storage_key: storageKey,
        original_filename: parsed.filename,
        original_size_bytes: parsed.size,
        status: "uploading",
      })
      .select()
      .single();

    if (insertError) return errorResponse(insertError.message);

    // Generate presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(storageKey, parsed.contentType);

    return NextResponse.json({ segment, uploadUrl }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
