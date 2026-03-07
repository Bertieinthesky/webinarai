/**
 * /api/track/conversion — URL rule conversion tracking
 *
 * Client-side script calls this when a viewer visits a URL that matches
 * a custom metric's URL pattern. Checks all metrics for the project
 * and records conversions for matching rules.
 *
 * PUBLIC ROUTE — no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, viewerId, sessionId, pageUrl } = body;

    if (!projectId || !viewerId || !pageUrl) {
      return corsResponse({ ok: true });
    }

    const admin = createAdminClient();

    // Get URL rule metrics for this project
    const { data: metrics } = await admin
      .from("custom_metrics")
      .select("id, url_pattern, match_type")
      .eq("project_id", projectId)
      .eq("metric_type", "url_rule");

    if (!metrics || metrics.length === 0) {
      return corsResponse({ ok: true });
    }

    // Find the viewer's variant
    let variantId: string | null = null;
    const { data: recentEvent } = await admin
      .from("view_events")
      .select("variant_id")
      .eq("project_id", projectId)
      .eq("viewer_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    variantId = recentEvent?.variant_id || null;

    // Check each metric against the page URL
    const matchingMetrics = metrics.filter((m) => {
      if (!m.url_pattern) return false;

      switch (m.match_type) {
        case "exact":
          return pageUrl === m.url_pattern;
        case "regex":
          try {
            return new RegExp(m.url_pattern).test(pageUrl);
          } catch {
            return false;
          }
        case "contains":
        default:
          return pageUrl.includes(m.url_pattern);
      }
    });

    if (matchingMetrics.length > 0) {
      // Insert conversion events for all matching metrics
      const events = matchingMetrics.map((m) => ({
        metric_id: m.id,
        project_id: projectId,
        variant_id: variantId,
        viewer_id: viewerId,
        session_id: sessionId || null,
        metadata: { page_url: pageUrl },
      }));

      await admin.from("custom_metric_events").insert(events);
    }

    return corsResponse({ ok: true });
  } catch {
    return corsResponse({ ok: true }); // Never fail tracking
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function corsResponse(data: Record<string, unknown>) {
  const response = NextResponse.json(data);
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}
