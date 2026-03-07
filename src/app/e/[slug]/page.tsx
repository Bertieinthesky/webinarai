/**
 * e/[slug]/page.tsx — Public embed page (SERVER COMPONENT)
 *
 * PURPOSE:
 *   Server-side rendered embed page. Fetches the variant assignment and
 *   video URLs at request time, so the poster image URL is baked into the
 *   initial HTML. The browser starts loading the poster as soon as the page
 *   arrives — no black flash, no waiting for a client-side API call.
 *
 * HOW IT WORKS:
 *   1. Reads the viewer ID from the wai_vid cookie (set by middleware)
 *   2. Fetches the project + rendered variants from Supabase
 *   3. Assigns a variant via deterministic hashing
 *   4. Passes all data (including posterUrl) to the EmbedClient component
 *
 * PUBLIC PAGE:
 *   No authentication required. Excluded from the auth middleware via
 *   the /e/* public route pattern. Designed for iframe embedding.
 */

import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignVariant, generateViewerId } from "@/lib/variant/assignment";
import { publicUrl } from "@/lib/storage/urls";
import { variantPosterKey, variantMicroSegmentKey } from "@/lib/storage/keys";
import { EmbedClient } from "./EmbedClient";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const cookieStore = await cookies();
    let viewerId = cookieStore.get("wai_vid")?.value;

    // Fallback: if middleware didn't set it (shouldn't happen), generate one
    if (!viewerId) {
      viewerId = generateViewerId();
    }

    const admin = createAdminClient();

    // Get project by slug
    const { data: project, error } = await admin
      .from("projects")
      .select("id, slug, status")
      .eq("slug", slug)
      .single();

    if (error || !project || project.status !== "ready") {
      return <EmbedError message="Video not available" />;
    }

    // Detect mobile from User-Agent for 720p serving
    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") || "";
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    // Get rendered variants
    const { data: variants } = await admin
      .from("variants")
      .select(
        "id, variant_code, video_storage_key, hook_clip_storage_key, hook_end_time_ms, video_duration_ms, micro_segment_storage_key, video_720p_storage_key, hls_master_manifest_key, hls_status"
      )
      .eq("project_id", project.id)
      .eq("status", "rendered")
      .order("variant_code");

    if (!variants || variants.length === 0) {
      return <EmbedError message="Video not available" />;
    }

    // Deterministic variant assignment (same viewer → same variant)
    const variantIndex = assignVariant(viewerId, project.id, variants.length);
    const variant = variants[variantIndex];

    if (!variant.hook_clip_storage_key || !variant.video_storage_key) {
      return <EmbedError message="Video not available" />;
    }

    const hookUrl = publicUrl(variant.hook_clip_storage_key);
    const poster = publicUrl(variantPosterKey(project.id, variant.id));

    // Mobile gets 720p if available, otherwise falls back to 1080p
    const fullVideoUrl = isMobile && variant.video_720p_storage_key
      ? publicUrl(variant.video_720p_storage_key)
      : publicUrl(variant.video_storage_key);

    // Micro-segment URL for turbo start (toggle via ?turbo=1 in embed URL)
    const microSegmentUrl = variant.micro_segment_storage_key
      ? publicUrl(variant.micro_segment_storage_key)
      : undefined;

    // HLS manifest URL for adaptive streaming (only when packaging is complete)
    const hlsManifestUrl =
      variant.hls_status === "ready" && variant.hls_master_manifest_key
        ? publicUrl(variant.hls_master_manifest_key)
        : undefined;

    return (
      <>
        {/* Preload hint — browser starts fetching these from the raw HTML,
            before any JS bundle loads. Saves 200-500ms on first paint. */}
        <link rel="preload" href={poster} as="image" />
        <link rel="preload" href={hookUrl} as="video" type="video/mp4" />

        <EmbedClient
          data={{
            projectId: project.id,
            variantId: variant.id,
            variantCode: variant.variant_code,
            hookClipUrl: hookUrl,
            fullVideoUrl,
            posterUrl: poster,
            hookEndTimeMs: variant.hook_end_time_ms ?? 0,
            totalDurationMs: variant.video_duration_ms ?? 0,
            microSegmentUrl,
            hlsManifestUrl,
          }}
          slug={slug}
        />
      </>
    );
  } catch {
    return <EmbedError message="Failed to load video" />;
  }
}

function EmbedError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#000",
        color: "#666",
        fontFamily: "system-ui",
      }}
    >
      {message}
    </div>
  );
}
