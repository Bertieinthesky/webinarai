/**
 * /api/projects/[projectId]/segments/[segmentId] — Individual segment management
 *
 * PURPOSE:
 *   PATCH and DELETE operations for a single segment within a project.
 *
 * ENDPOINTS:
 *   PATCH — Updates segment fields (e.g., status to "uploaded" after R2
 *           upload completes, or label rename). The SegmentUploader component
 *           calls this after a successful direct-to-R2 upload.
 *
 *   DELETE — Removes a segment record. The corresponding R2 file should
 *            also be cleaned up (TODO: add R2 deletion).
 *
 * SECURITY:
 *   Uses the server Supabase client (cookie-based auth). RLS policies
 *   ensure users can only modify segments belonging to their own projects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, errorResponse } from "@/lib/utils/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; segmentId: string }> }
) {
  try {
    const { projectId, segmentId } = await params;
    const body = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("segments")
      .update(body)
      .eq("id", segmentId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) return errorResponse(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; segmentId: string }> }
) {
  try {
    const { projectId, segmentId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("segments")
      .delete()
      .eq("id", segmentId)
      .eq("project_id", projectId);

    if (error) return errorResponse(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
