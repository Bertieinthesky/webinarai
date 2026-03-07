/**
 * /api/tools/splitter/[splitId]/split — Trigger the split job
 *
 * POST: Validates markers, creates split_clips records, enqueues BullMQ job.
 *
 * Markers define split points within the video. The API converts them to
 * clip ranges: [0 → marker1], [marker1 → marker2], ..., [markerN → end].
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitClipKey } from "@/lib/storage/keys";
import { enqueueSplit } from "@/lib/queue/jobs";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { Database } from "@/lib/supabase/types";

type SplitRow = Database["public"]["Tables"]["splits"]["Row"];

type RouteContext = { params: Promise<{ splitId: string }> };

const triggerSplitSchema = z.object({
  markers: z
    .array(
      z.object({
        time_ms: z.number().nonnegative(),
        label: z.string().max(100),
      })
    )
    .min(1, "At least one marker is required"),
  durationMs: z.number().positive("Source duration is required"),
});

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
    if (split.status === "splitting") return errorResponse("Split already in progress", 409);

    const body = await req.json();
    const parsed = triggerSplitSchema.parse(body);

    // Sort markers by time
    const sortedMarkers = [...parsed.markers].sort((a, b) => a.time_ms - b.time_ms);

    // Convert markers to clip ranges: [0→m1], [m1→m2], ..., [mN→end]
    const clipRanges: Array<{
      startMs: number;
      endMs: number;
      label: string;
    }> = [];

    for (let i = 0; i <= sortedMarkers.length; i++) {
      const startMs = i === 0 ? 0 : sortedMarkers[i - 1].time_ms;
      const endMs =
        i === sortedMarkers.length
          ? parsed.durationMs
          : sortedMarkers[i].time_ms;

      // Label: use the marker label for the segment that STARTS at that marker.
      // First segment (before any marker) gets "Segment 1" or the first marker's label.
      const label =
        i === 0
          ? sortedMarkers[0]?.label || "Segment 1"
          : sortedMarkers[i - 1].label || `Segment ${i + 1}`;

      if (endMs > startMs) {
        clipRanges.push({ startMs, endMs, label });
      }
    }

    if (clipRanges.length === 0) {
      return errorResponse("No valid clip ranges from markers");
    }

    // Create split_clips records
    const clips = clipRanges.map((range, index) => ({
      id: randomUUID(),
      split_id: splitId,
      clip_index: index,
      label: range.label,
      start_ms: range.startMs,
      end_ms: range.endMs,
      storage_key: splitClipKey(splitId, index),
      status: "pending" as const,
    }));

    // Delete any existing clips (in case of re-split)
    await admin.from("split_clips").delete().eq("split_id", splitId);

    const { error: insertError } = await admin.from("split_clips").insert(clips);
    if (insertError) return errorResponse(insertError.message);

    // Save markers on the split record and update status
    await admin
      .from("splits")
      .update({
        markers: sortedMarkers,
        status: "splitting",
        source_duration_ms: parsed.durationMs,
        error_message: null,
      })
      .eq("id", splitId);

    // Enqueue BullMQ job
    await enqueueSplit({
      splitId,
      sourceStorageKey: split.source_storage_key,
      clips: clips.map((c) => ({
        clipId: c.id,
        clipIndex: c.clip_index,
        startMs: c.start_ms,
        endMs: c.end_ms,
        label: c.label,
        outputStorageKey: c.storage_key!,
      })),
    });

    return NextResponse.json({ splitId, clipCount: clips.length }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
