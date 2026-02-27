/**
 * /api/embed/[slug] — Public variant assignment endpoint
 *
 * PURPOSE:
 *   This is the first API call the embed player makes. It determines WHICH
 *   variant a viewer should see and returns the CDN URLs for the hook clip
 *   and full video. This endpoint is on the critical path for every embed
 *   load — it must be fast.
 *
 * HOW IT WORKS:
 *   1. Looks up the project by slug
 *   2. Gets all rendered variants
 *   3. Reads/creates a viewer ID cookie (anonymous, for consistent assignment)
 *   4. Uses deterministic hashing to assign a variant (same viewer = same variant)
 *   5. Returns the assigned variant's video URLs and timing data
 *
 * CORS:
 *   This endpoint allows cross-origin requests (Access-Control-Allow-Origin: *)
 *   because the embed player runs on third-party websites.
 *
 * PRODUCTION NOTE:
 *   In production, this should use Edge Runtime for global low-latency responses.
 *   Currently using Node.js runtime for development simplicity.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignVariant, generateViewerId } from "@/lib/variant/assignment";
import { publicUrl } from "@/lib/storage/urls";

export const runtime = "nodejs"; // Use edge in production for global low latency

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const admin = createAdminClient();

    // Get project by slug
    const { data: project, error } = await admin
      .from("projects")
      .select("id, slug, status")
      .eq("slug", slug)
      .single();

    if (error || !project || project.status !== "ready") {
      return NextResponse.json(
        { error: "Project not found or not ready" },
        { status: 404 }
      );
    }

    // Get rendered variants
    const { data: variants } = await admin
      .from("variants")
      .select(
        "id, variant_code, video_storage_key, hook_clip_storage_key, hook_end_time_ms, video_duration_ms"
      )
      .eq("project_id", project.id)
      .eq("status", "rendered")
      .order("variant_code");

    if (!variants || variants.length === 0) {
      return NextResponse.json(
        { error: "No rendered variants" },
        { status: 404 }
      );
    }

    // Get or create viewer ID from cookie
    let viewerId = req.cookies.get("wai_vid")?.value;
    if (!viewerId) {
      viewerId = generateViewerId();
    }

    // Deterministic variant assignment
    const variantIndex = assignVariant(viewerId, project.id, variants.length);
    const variant = variants[variantIndex];

    const response = NextResponse.json({
      projectId: project.id,
      variantId: variant.id,
      variantCode: variant.variant_code,
      hookClipUrl: publicUrl(variant.hook_clip_storage_key!),
      fullVideoUrl: publicUrl(variant.video_storage_key!),
      hookEndTimeMs: variant.hook_end_time_ms,
      totalDurationMs: variant.video_duration_ms,
    });

    // Set viewer ID cookie
    response.cookies.set("wai_vid", viewerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });

    // CORS headers for cross-domain embed
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, OPTIONS"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");

    return response;
  } catch (error) {
    console.error("Embed API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
