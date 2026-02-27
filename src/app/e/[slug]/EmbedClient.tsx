/**
 * EmbedClient.tsx — Client-side embed player
 *
 * PURPOSE:
 *   Handles all client-side interactivity for the embed page:
 *   - Blob preloading of the hook clip (for instant playback on click)
 *   - Service worker registration (caching on repeat visits)
 *   - Rendering the SmartSyncPlayer
 *
 *   The embed data (including posterUrl) is passed from the server component
 *   as props, so the poster is already in the HTML on first paint — no black
 *   flash, no loading spinner.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { SmartSyncPlayer } from "@/components/player/SmartSyncPlayer";

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

interface EmbedClientProps {
  data: EmbedData;
  slug: string;
}

export function EmbedClient({ data, slug }: EmbedClientProps) {
  const [hookBlobUrl, setHookBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Register service worker for caching hook clips and posters on repeat visits
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  // Predictive preload: fetch hook clip into memory as a blob
  // so playback is instant when the user clicks play
  useEffect(() => {
    fetch(data.hookClipUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setHookBlobUrl(url);
      })
      .catch(() => {
        // Fall back to CDN URL if preload fails
      });

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [data.hookClipUrl]);

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
        <SmartSyncPlayer
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
