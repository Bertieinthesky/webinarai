/**
 * e/[slug]/page.tsx — Public embed page
 *
 * PURPOSE:
 *   This is the page that end-users see when the embed iframe loads.
 *   It's a minimal full-screen page that:
 *     1. Fetches the variant assignment from /api/embed/[slug]
 *     2. Renders the EmbedPlayer with the assigned variant's video URLs
 *
 * VISUAL STATES:
 *   - Loading: Centered spinner on black background
 *   - Error: Centered error message on black background
 *   - Ready: Full-screen EmbedPlayer (16:9, max 1280px wide)
 *
 * PUBLIC PAGE:
 *   This page does NOT require authentication. It's excluded from the
 *   auth middleware via the /e/* public route pattern. It's designed to
 *   load inside an iframe on third-party websites.
 *
 * ARCHITECTURE:
 *   - Fetches: /api/embed/[slug] (variant assignment + video URLs)
 *   - Renders: EmbedPlayer component (dual-player with hook preloading)
 *   - No layout: Renders standalone (no sidebar, no navigation)
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmbedPlayer } from "@/components/player/EmbedPlayer";

interface EmbedData {
  projectId: string;
  variantId: string;
  variantCode: string;
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  totalDurationMs: number;
}

export default function EmbedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<EmbedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVariant() {
      try {
        const res = await fetch(`/api/embed/${slug}`);
        if (!res.ok) {
          throw new Error("Video not available");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load video");
      }
    }
    fetchVariant();
  }, [slug]);

  if (error) {
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
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#000",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(255,255,255,0.2)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1280 }}>
        <EmbedPlayer
          hookClipUrl={data.hookClipUrl}
          fullVideoUrl={data.fullVideoUrl}
          hookEndTimeMs={data.hookEndTimeMs}
          variantId={data.variantId}
          projectSlug={slug}
        />
      </div>
    </div>
  );
}
