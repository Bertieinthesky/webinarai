import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteByPrefix } from "@/lib/storage/r2";
import { handleApiError, errorResponse } from "@/lib/utils/errors";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const admin = createAdminClient();

    // Verify project exists
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return errorResponse("Project not found", 404);
    }

    // Delete all R2 files for this project
    await deleteByPrefix(`projects/${projectId}/`).catch(() => {});

    // Delete project (cascades to segments, variants, views, processing_jobs)
    const { error } = await admin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) return errorResponse(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
