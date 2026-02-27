/**
 * /api/track — Public event tracking endpoint
 *
 * PURPOSE:
 *   Receives analytics events from the embed player (play, progress_25,
 *   progress_50, progress_75, complete). These events are used to measure
 *   variant performance in A/B tests.
 *
 * CURRENT STATE (Phase 1):
 *   Events are logged to console only. Full analytics storage (inserting
 *   into the views table, computing conversion rates, statistical significance)
 *   will be built in Phase 2.
 *
 * DESIGN PRINCIPLES:
 *   - NEVER fails: Returns 200 even on errors. Tracking must never break
 *     the viewer's experience.
 *   - CORS enabled: Called from third-party websites via the embed player
 *   - Receives: event name, variantId, projectSlug, timestamp
 *   - Sent via: navigator.sendBeacon (reliable even on page close)
 *
 * PUBLIC ROUTE:
 *   Excluded from auth middleware. No authentication required.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, variantId } = body;

    if (!event || !variantId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // For now, just log events. Full analytics in Phase 2.
    console.log(`[track] ${event} — variant: ${variantId}`);

    // CORS headers
    const response = NextResponse.json({ ok: true });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } catch {
    return NextResponse.json({ ok: true }); // Never fail tracking
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
