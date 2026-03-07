/**
 * /api/tools/splitter — Create and list video splits
 *
 * POST: Creates a new split record + returns a presigned upload URL
 *       for the source video (browser-to-R2 direct upload).
 *
 * GET:  Lists all splits for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPresignedUploadUrl } from "@/lib/storage/r2";
import { splitSourceKey } from "@/lib/storage/keys";
import { handleApiError, errorResponse } from "@/lib/utils/errors";
import { z } from "zod";
import { randomUUID } from "crypto";

const createSplitSchema = z.object({
  filename: z.string().min(1),
  size: z.number().positive(),
  contentType: z.string().min(1),
  name: z.string().max(200).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("splits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return errorResponse(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const parsed = createSplitSchema.parse(body);

    const splitId = randomUUID();
    const storageKey = splitSourceKey(splitId);

    const admin = createAdminClient();
    const { data: split, error: insertError } = await admin
      .from("splits")
      .insert({
        id: splitId,
        user_id: user.id,
        name: parsed.name || parsed.filename,
        source_storage_key: storageKey,
        source_filename: parsed.filename,
        source_size_bytes: parsed.size,
        status: "uploaded",
      })
      .select()
      .single();

    if (insertError) return errorResponse(insertError.message);

    const uploadUrl = await getPresignedUploadUrl(storageKey, parsed.contentType);

    return NextResponse.json({ split, uploadUrl }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
