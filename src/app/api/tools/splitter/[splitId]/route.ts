/**
 * /api/tools/splitter/[splitId] — Single split CRUD
 *
 * GET:    Fetch split + its clips.
 * PATCH:  Update markers, name, or source metadata.
 * DELETE: Delete split + all R2 files.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteByPrefix, getPresignedDownloadUrl } from "@/lib/storage/r2";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

type SplitClipRow = Database["public"]["Tables"]["split_clips"]["Row"];

type RouteContext = { params: Promise<{ splitId: string }> };

const updateSplitSchema = z.object({
  name: z.string().max(200).optional(),
  markers: z
    .array(
      z.object({
        time_ms: z.number().nonnegative(),
        label: z.string().max(100),
      })
    )
    .optional(),
  source_duration_ms: z.number().positive().optional(),
  source_width: z.number().positive().optional(),
  source_height: z.number().positive().optional(),
  status: z.enum(["uploaded", "splitting", "completed", "failed"]).optional(),
});

/** Verify the split belongs to the authenticated user. */
async function verifySplitOwner(splitId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Unauthorized" as const };

  const admin = createAdminClient();
  const { data: split, error } = await admin
    .from("splits")
    .select("*")
    .eq("id", splitId)
    .eq("user_id", user.id)
    .single();

  if (error || !split) return { user, error: "Split not found" as const };
  return { user, split, error: null };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { splitId } = await params;
    const result = await verifySplitOwner(splitId);
    if (result.error === "Unauthorized") return errorResponse("Unauthorized", 401);
    if (result.error) return errorResponse(result.error, 404);

    const admin = createAdminClient();
    const { data: clips, error: clipsError } = await admin
      .from("split_clips")
      .select("*")
      .eq("split_id", splitId)
      .order("clip_index");

    if (clipsError) return errorResponse(clipsError.message);

    // If ?download=clipId is passed, return a presigned download URL
    const downloadClipId = req.nextUrl.searchParams.get("download");
    if (downloadClipId) {
      const clip = (clips as unknown as SplitClipRow[])?.find(
        (c) => c.id === downloadClipId
      );
      if (!clip?.storage_key) return errorResponse("Clip not found", 404);

      const downloadUrl = await getPresignedDownloadUrl(clip.storage_key);
      return NextResponse.json({ downloadUrl });
    }

    return NextResponse.json({ split: result.split, clips });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { splitId } = await params;
    const result = await verifySplitOwner(splitId);
    if (result.error === "Unauthorized") return errorResponse("Unauthorized", 401);
    if (result.error) return errorResponse(result.error, 404);

    const body = await req.json();
    const parsed = updateSplitSchema.parse(body);

    const admin = createAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("splits")
      .update(parsed)
      .eq("id", splitId)
      .select()
      .single();

    if (updateError) return errorResponse(updateError.message);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { splitId } = await params;
    const result = await verifySplitOwner(splitId);
    if (result.error === "Unauthorized") return errorResponse("Unauthorized", 401);
    if (result.error) return errorResponse(result.error, 404);

    // Delete R2 files (source + clips)
    await deleteByPrefix(`splits/${splitId}/`);

    // Delete DB record (cascades to split_clips)
    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from("splits")
      .delete()
      .eq("id", splitId);

    if (deleteError) return errorResponse(deleteError.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
