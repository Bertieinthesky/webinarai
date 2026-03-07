/**
 * /api/projects/[projectId]/metrics — Custom metrics CRUD
 *
 * GET: List all custom metrics for a project
 * POST: Create a new custom metric (url_rule or webhook)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, handleApiError } from "@/lib/utils/errors";
import { randomUUID } from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

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

    const { data: metrics } = await admin
      .from("custom_metrics")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    // Add event counts for each metric
    const metricsWithCounts = await Promise.all(
      (metrics || []).map(async (m) => {
        const { count } = await admin
          .from("custom_metric_events")
          .select("*", { count: "exact", head: true })
          .eq("metric_id", m.id);
        return { ...m, event_count: count || 0 };
      })
    );

    return NextResponse.json({ metrics: metricsWithCounts });
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
    const { name, metric_type, url_pattern, match_type, description } = body;

    if (!name) return errorResponse("Name is required");

    const insert = {
      project_id: projectId,
      name: name as string,
      metric_type: (metric_type || "url_rule") as "url_rule" | "webhook",
      description: (description as string) || null,
      url_pattern: metric_type === "webhook" ? null : (url_pattern as string) || null,
      match_type: metric_type === "webhook" ? null : ((match_type as string) || "contains") as "contains" | "exact" | "regex",
      webhook_key: metric_type === "webhook"
        ? randomUUID().replace(/-/g, "").slice(0, 24)
        : null,
    };

    const { data: metric, error } = await admin
      .from("custom_metrics")
      .insert(insert)
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
