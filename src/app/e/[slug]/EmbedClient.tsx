/**
 * EmbedClient.tsx — Client-side embed player
 *
 * PURPOSE:
 *   Handles all client-side interactivity for the embed page:
 *   - Detects mobile vs desktop
 *   - Mobile: renders SimpleMobilePlayer (single <video>, no dual-decode)
 *   - Desktop: blob preloads hook clip, renders SmartSyncPlayer (dual-video)
 *   - Service worker registration (caching on repeat visits)
 *
 * WHY TWO PLAYERS:
 *   Mobile devices (80% of traffic) can't reliably decode two H.264 streams
 *   simultaneously. The SmartSync dual-video approach causes memory pressure,
 *   decoder contention, and battery drain on phones. On desktop, the extra
 *   memory and decoder capacity makes dual-video instant start worthwhile.
 */

"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { SmartSyncPlayer } from "@/components/player/SmartSyncPlayer";
import { SimpleMobilePlayer } from "@/components/player/SimpleMobilePlayer";

interface EmbedData {
  projectId: string;
  variantId: string;
  variantCode: string;
  hookClipUrl: string;
  fullVideoUrl: string;
  posterUrl: string;
  hookEndTimeMs: number;
  totalDurationMs: number;
  microSegmentUrl?: string;
  hlsManifestUrl?: string;
}

interface EmbedClientProps {
  data: EmbedData;
  slug: string;
}

/**
 * Detect mobile devices via user agent.
 * Intentionally simple — covers iPhone, iPad, Android, and common mobile browsers.
 * Desktop gets SmartSync (dual-video). Mobile gets SimpleMobilePlayer (single video).
 */
function useIsMobile(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);
}

/**
 * Check for ?turbo=1 in the embed URL to enable micro-segment turbo start.
 * This lets the user toggle the feature on/off for A/B comparison.
 */
function useTurboEnabled(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("turbo") === "1";
  }, []);
}

export function EmbedClient({ data, slug }: EmbedClientProps) {
  const isMobile = useIsMobile();
  const turboEnabled = useTurboEnabled();
  const [hookBlobUrl, setHookBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Register service worker for caching on repeat visits
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  // Mobile: background fetch — start pulling the full video into the
  // browser's HTTP cache immediately on page load. By the time the user
  // clicks play, a chunk is already cached. Free 200-500ms improvement.
  //
  // Desktop: blob preload the hook clip for instant playback.
  useEffect(() => {
    if (isMobile) {
      // Fire-and-forget background fetch. We don't use the response —
      // just warming the browser's HTTP cache so <video preload="auto">
      // gets a head start.
      const controller = new AbortController();
      fetch(data.fullVideoUrl, { signal: controller.signal }).catch(() => {});
      return () => controller.abort();
    }

    // Desktop: blob preload hook clip
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
  }, [data.hookClipUrl, data.fullVideoUrl, isMobile]);

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
        {isMobile ? (
          <SimpleMobilePlayer
            fullVideoUrl={data.fullVideoUrl}
            posterUrl={data.posterUrl}
            variantId={data.variantId}
            projectSlug={slug}
            microSegmentUrl={turboEnabled ? data.microSegmentUrl : undefined}
            hlsManifestUrl={data.hlsManifestUrl}
          />
        ) : (
          <SmartSyncPlayer
            hookClipUrl={hookBlobUrl || data.hookClipUrl}
            fullVideoUrl={data.fullVideoUrl}
            hookEndTimeMs={data.hookEndTimeMs}
            posterUrl={data.posterUrl}
            variantId={data.variantId}
            projectSlug={slug}
            hookPreloaded={!!hookBlobUrl}
            hlsManifestUrl={data.hlsManifestUrl}
          />
        )}
      </div>
    </div>
  );
}
