/**
 * /api/projects/[projectId]/metrics/[metricId] — Single metric operations
 *
 * PATCH: Update metric name, pattern, etc.
 * DELETE: Remove metric and its events
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, handleApiError } from "@/lib/utils/errors";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; metricId: string }> }
) {
  try {
    const { projectId, metricId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const admin = createAdminClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();
    if (!project || project.user_id !== user.id)
      return errorResponse("Not found", 404);

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.url_pattern === "string")
      updates.url_pattern = body.url_pattern;
    if (typeof body.match_type === "string")
      updates.match_type = body.match_type;
    if (typeof body.description === "string")
      updates.description = body.description;

    if (Object.keys(updates).length === 0) {
      return errorResponse("No valid fields to update");
    }

    const { error } = await admin
      .from("custom_metrics")
      .update(updates)
      .eq("id", metricId)
      .eq("project_id", projectId);

    if (error) return errorResponse(error.message, 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; metricId: string }> }
) {
  try {
    const { projectId, metricId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const admin = createAdminClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();
    if (!project || project.user_id !== user.id)
      return errorResponse("Not found", 404);

    // Delete metric (cascades to custom_metric_events)
    const { error } = await admin
      .from("custom_metrics")
      .delete()
      .eq("id", metricId)
      .eq("project_id", projectId);

    if (error) return errorResponse(error.message, 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
