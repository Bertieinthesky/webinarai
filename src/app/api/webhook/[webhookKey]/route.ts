/**
 * /api/webhook/[webhookKey] — External conversion webhook
 *
 * External systems POST to this endpoint to record a conversion event.
 * Looks up the metric by webhook key, finds the viewer's variant, and records.
 *
 * PUBLIC ROUTE — no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ webhookKey: string }> }
) {
  try {
    const { webhookKey } = await params;
    const admin = createAdminClient();

    // Look up metric by webhook key
    const { data: metric } = await admin
      .from("custom_metrics")
      .select("id, project_id")
      .eq("webhook_key", webhookKey)
      .single();

    if (!metric) {
      return NextResponse.json({ error: "Invalid webhook key" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const viewerId = body.viewerId || body.viewer_id || "unknown";
    const sessionId = body.sessionId || body.session_id || null;

    // Try to find the viewer's variant from recent view_events
    let variantId: string | null = null;
    if (viewerId !== "unknown") {
      const { data: recentEvent } = await admin
        .from("view_events")
        .select("variant_id")
        .eq("project_id", metric.project_id)
        .eq("viewer_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      variantId = recentEvent?.variant_id || null;
    }

    // Record conversion event
    await admin.from("custom_metric_events").insert({
      metric_id: metric.id,
      project_id: metric.project_id,
      variant_id: variantId,
      viewer_id: viewerId,
      session_id: sessionId,
      metadata: body.metadata || {},
    });

    const response = NextResponse.json({ ok: true });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } catch {
    return NextResponse.json({ ok: true }); // Never fail webhooks
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
