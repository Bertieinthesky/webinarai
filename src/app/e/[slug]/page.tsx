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
 *   - Loading: Static play button on black background (looks ready to play)
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

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EmbedPlayer } from "@/components/player/EmbedPlayer";

interface EmbedData {
  projectId: string;
  variantId: string;
  variantCode: string;
  hookClipUrl: string;
  fullVideoUrl: string;
  posterUrl: string;
  hookEndTimeMs: number;
  totalDurationMs: number;
}

export default function EmbedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<EmbedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hookBlobUrl, setHookBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Register service worker for caching hook clips and posters on repeat visits
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    async function fetchVariant() {
      try {
        const res = await fetch(`/api/embed/${slug}`);
        if (!res.ok) {
          throw new Error("Video not available");
        }
        const json = await res.json();
        setData(json);

        // Predictive preload: fetch hook clip into memory as a blob
        // so playback is instant when the user clicks play
        fetch(json.hookClipUrl)
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            setHookBlobUrl(url);
          })
          .catch(() => {
            // Fall back to CDN URL if preload fails
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load video");
      }
    }
    fetchVariant();

    return () => {
      // Clean up blob URL on unmount
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
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
          width: "100vw",
          height: "100vh",
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1280 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: "#000",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </div>
          </div>
        </div>
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
          hookClipUrl={hookBlobUrl || data.hookClipUrl}
          fullVideoUrl={data.fullVideoUrl}
          hookEndTimeMs={data.hookEndTimeMs}
          posterUrl={data.posterUrl}
          variantId={data.variantId}
          projectSlug={slug}
        />
      </div>
    </div>
  );
}
