/**
 * /api/tools/splitter/[splitId]/create-project — Create a project from split clips
 *
 * POST: Creates a new project + segments from the split's completed clips.
 *       Segment original_storage_key points directly at the clip's R2 key
 *       (no file copy). Redirects user to the new project.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import { generateSlug } from "@/lib/utils/slug";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { Database } from "@/lib/supabase/types";

type SplitRow = Database["public"]["Tables"]["splits"]["Row"];
type SplitClipRow = Database["public"]["Tables"]["split_clips"]["Row"];

type RouteContext = { params: Promise<{ splitId: string }> };

const createProjectSchema = z.object({
  projectName: z.string().min(1).max(200),
  clipAssignments: z
    .array(
      z.object({
        clipId: z.string().uuid(),
        type: z.enum(["hook", "body", "cta"]),
        label: z.string().min(1).max(100),
      })
    )
    .min(1, "At least one clip assignment is required"),
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

    const admin = createAdminClient();

    // Verify split ownership
    const { data: splitData, error: splitError } = await admin
      .from("splits")
      .select("*")
      .eq("id", splitId)
      .eq("user_id", user.id)
      .single();

    if (splitError || !splitData) return errorResponse("Split not found", 404);
    const split = splitData as unknown as SplitRow;
    if (split.status !== "completed") {
      return errorResponse("Split must be completed before creating a project", 400);
    }

    const body = await req.json();
    const parsed = createProjectSchema.parse(body);

    // Fetch the clips to get storage keys and metadata
    const { data: allClips, error: clipsError } = await admin
      .from("split_clips")
      .select("*")
      .eq("split_id", splitId)
      .in(
        "id",
        parsed.clipAssignments.map((a) => a.clipId)
      );

    if (clipsError) return errorResponse(clipsError.message);
    if (!allClips || allClips.length === 0) {
      return errorResponse("No matching clips found");
    }

    // Map clips by ID for quick lookup
    const clips = allClips as unknown as SplitClipRow[];
    const clipMap = new Map(clips.map((c) => [c.id, c]));

    // Create project
    const projectId = randomUUID();
    const { error: projectError } = await admin.from("projects").insert({
      id: projectId,
      user_id: user.id,
      name: parsed.projectName,
      slug: generateSlug(),
      status: "draft",
    });

    if (projectError) return errorResponse(projectError.message);

    // Create segments from clip assignments
    const segments = parsed.clipAssignments.map((assignment, index) => {
      const clip = clipMap.get(assignment.clipId);
      if (!clip) return null;

      return {
        id: randomUUID(),
        project_id: projectId,
        type: assignment.type,
        label: assignment.label,
        sort_order: index,
        original_storage_key: clip.storage_key,
        original_size_bytes: clip.size_bytes,
        original_duration_ms: clip.duration_ms,
        original_width: split.source_width,
        original_height: split.source_height,
        status: "uploaded" as const,
      };
    });

    const validSegments = segments.filter(
      (s): s is NonNullable<typeof s> => s !== null
    );
    if (validSegments.length === 0) {
      return errorResponse("No valid segments could be created");
    }

    const { error: segmentsError } = await admin
      .from("segments")
      .insert(validSegments);

    if (segmentsError) return errorResponse(segmentsError.message);

    return NextResponse.json({ projectId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
