/**
 * /api/projects/[projectId]/analytics — Analytics aggregation endpoint
 *
 * Returns variant-level and segment-level aggregated analytics data
 * using Postgres RPC functions for efficient server-side aggregation.
 *
 * Query params:
 *   ?startDate=ISO  — Filter events after this date
 *   ?endDate=ISO    — Filter events before this date
 *   ?segmentType=hook|body|cta — Include segment-level analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, handleApiError } from "@/lib/utils/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Verify ownership via auth client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const admin = createAdminClient();

    // Verify project belongs to user
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();

    if (!project || project.user_id !== user.id) {
      return errorResponse("Project not found", 404);
    }

    // Parse query params
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate") || null;
    const endDate = url.searchParams.get("endDate") || null;
    const segmentType = url.searchParams.get("segmentType") || null;

    // Fetch variant analytics
    const { data: variantAnalytics, error: variantError } = await admin.rpc(
      "get_variant_analytics",
      {
        p_project_id: projectId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (variantError) {
      console.error("Variant analytics error:", variantError);
      return errorResponse("Failed to fetch analytics", 500);
    }

    // Fetch daily views for charting
    const { data: dailyViews, error: dailyError } = await admin.rpc(
      "get_daily_views",
      {
        p_project_id: projectId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (dailyError) {
      console.error("Daily views error:", dailyError);
    }

    // Optionally fetch segment analytics
    let segmentAnalytics = null;
    if (segmentType && ["hook", "body", "cta"].includes(segmentType)) {
      const { data, error } = await admin.rpc("get_segment_analytics", {
        p_project_id: projectId,
        p_segment_type: segmentType,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (!error) {
        segmentAnalytics = data;
      }
    }

    // Compute summary
    const variants = variantAnalytics || [];
    let totalViews = 0;
    let totalCompletions = 0;
    for (const v of variants) {
      totalViews += v.total_views || 0;
      totalCompletions += v.complete_count || 0;
    }
    const overallCompletionRate =
      totalViews > 0
        ? Math.round((totalCompletions / totalViews) * 10000) / 100
        : 0;

    // Find top performer
    let topPerformer: (typeof variants)[number] | null = null;
    for (const v of variants) {
      if (!topPerformer || (v.completion_rate || 0) > (topPerformer.completion_rate || 0)) {
        topPerformer = v;
      }
    }

    return NextResponse.json({
      summary: {
        totalViews,
        totalCompletions,
        overallCompletionRate,
        topPerformer,
      },
      variants: variantAnalytics || [],
      dailyViews: dailyViews || [],
      segmentAnalytics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
