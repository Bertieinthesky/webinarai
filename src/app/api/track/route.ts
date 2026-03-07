/**
 * /api/track — Public event tracking endpoint
 *
 * PURPOSE:
 *   Receives analytics events from the embed player (play, progress_25,
 *   progress_50, progress_75, complete). Writes events to the view_events
 *   table for analytics aggregation.
 *
 * DESIGN PRINCIPLES:
 *   - NEVER fails: Returns 200 even on errors. Tracking must never break
 *     the viewer's experience.
 *   - CORS enabled: Called from third-party websites via the embed player
 *   - Receives: event, variantId, viewerId, sessionId, timestamp
 *   - Sent via: navigator.sendBeacon (reliable even on page close)
 *
 * PUBLIC ROUTE:
 *   Excluded from auth middleware. No authentication required.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_EVENTS = new Set([
  "play",
  "progress_25",
  "progress_50",
  "progress_75",
  "complete",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, variantId, viewerId, sessionId, timestamp } = body;

    if (!event || !variantId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate event type
    if (!VALID_EVENTS.has(event)) {
      return corsResponse({ ok: true });
    }

    // Look up project_id from the variant
    const admin = createAdminClient();
    const { data: variant } = await admin
      .from("variants")
      .select("project_id")
      .eq("id", variantId)
      .single();

    if (!variant) {
      // Variant not found — still return 200 to not break the player
      return corsResponse({ ok: true });
    }

    // Insert event into view_events
    await admin.from("view_events").insert({
      project_id: variant.project_id,
      variant_id: variantId,
      viewer_id: viewerId || "anonymous",
      session_id: sessionId || "unknown",
      event_type: event,
      timestamp_ms: timestamp || Date.now(),
      referrer: body.referrer || null,
      user_agent: body.userAgent || null,
    });

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
