/**
 * /api/projects/[projectId]/variants/[variantId] — Variant management
 *
 * PATCH: Update variant custom_name and/or weight
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, handleApiError } from "@/lib/utils/errors";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; variantId: string }> }
) {
  try {
    const { projectId, variantId } = await params;

    // Verify ownership
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

    // Verify variant belongs to project
    const { data: variant } = await admin
      .from("variants")
      .select("id")
      .eq("id", variantId)
      .eq("project_id", projectId)
      .single();

    if (!variant) {
      return errorResponse("Variant not found", 404);
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.custom_name === "string" || body.custom_name === null) {
      updates.custom_name = body.custom_name;
    }

    if (typeof body.weight === "number") {
      updates.weight = body.weight;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("No valid fields to update", 400);
    }

    const { error } = await admin
      .from("variants")
      .update(updates)
      .eq("id", variantId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
