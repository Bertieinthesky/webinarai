/**
 * /api/projects/[projectId]/upload — Proxy upload to R2
 *
 * PURPOSE:
 *   Proxies file uploads from the browser to Cloudflare R2, bypassing CORS
 *   restrictions. The browser sends the file here, and this route streams
 *   it to R2 using the presigned URL.
 *
 *   In production with CORS configured on R2, the browser can upload
 *   directly via presigned URLs. This proxy exists for development
 *   and as a fallback.
 *
 * EXPECTS:
 *   PUT with query params: ?key=<storage_key>&contentType=<mime_type>
 *   Body: raw file bytes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFromBuffer } from "@/lib/storage/r2";
import { handleApiError, errorResponse } from "@/lib/utils/errors";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    // Verify authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    // Verify project belongs to user
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) return errorResponse("Project not found", 404);

    const key = req.nextUrl.searchParams.get("key");
    const contentType = req.nextUrl.searchParams.get("contentType") || "video/mp4";

    if (!key) return errorResponse("Missing key parameter", 400);

    const body = await req.arrayBuffer();
    await uploadFromBuffer(key, Buffer.from(body), contentType);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
