/**
 * /api/tools/splitter/[splitId]/analyze — Trigger scene detection analysis
 *
 * POST: Enqueues a BullMQ "analyze" job that runs FFmpeg scene detection
 * and silence detection on the uploaded video. Results are stored as
 * scene_points JSONB on the split record.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAnalyze } from "@/lib/queue/jobs";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import type { Database } from "@/lib/supabase/types";

type SplitRow = Database["public"]["Tables"]["splits"]["Row"];
type RouteContext = { params: Promise<{ splitId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { splitId } = await params;

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    // Fetch split and verify ownership
    const admin = createAdminClient();
    const { data: splitData, error: splitError } = await admin
      .from("splits")
      .select("*")
      .eq("id", splitId)
      .eq("user_id", user.id)
      .single();

    if (splitError || !splitData) return errorResponse("Split not found", 404);
    const split = splitData as unknown as SplitRow;

    // Don't re-analyze if we already have results
    if (split.scene_points && (split.scene_points as unknown[]).length > 0) {
      return NextResponse.json({
        splitId,
        status: "already_analyzed",
        pointCount: (split.scene_points as unknown[]).length,
      });
    }

    // Enqueue analysis job
    await enqueueAnalyze({
      splitId,
      sourceStorageKey: split.source_storage_key,
    });

    return NextResponse.json({ splitId, status: "analyzing" }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
