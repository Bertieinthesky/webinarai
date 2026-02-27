/**
 * EmbedPlayer.tsx — The smart video player component
 *
 * PURPOSE:
 *   This is the video player that end-users see on websites where the embed
 *   code is installed. It's the public-facing heart of webinar.ai — the thing
 *   that makes the platform feel magical to both the marketer and their audience.
 *
 * HOW IT WORKS:
 *   Renders TWO <video> elements stacked on top of each other:
 *     1. Hook clip player (visible first) — small file, loads and plays instantly
 *     2. Full variant player (hidden, buffering) — complete pre-rendered video
 *   When the hook finishes, the swap happens in a single frame — the viewer
 *   never notices the transition. They just see a video that started instantly.
 *
 * VISUAL STATES:
 *   - Idle: Play button overlay on black background (waiting for user click)
 *   - Playing hook: Hook clip video is visible and playing
 *   - Swapping: Brief loading spinner if full video hasn't buffered yet
 *   - Playing full: Full variant video is visible and playing
 *   - Ended: Video finished, full player shows last frame
 *
 * ANALYTICS:
 *   Tracks play, progress (25%/50%/75%), and completion events via the
 *   /api/track endpoint. Uses sendBeacon for reliability (fires even on
 *   page close). Tracking never breaks the player — errors are silently caught.
 *
 * ARCHITECTURE:
 *   - Uses: usePlayerSwap hook for all player state management
 *   - Used by: /e/[slug] embed page, dashboard preview
 *   - In production: This component gets bundled as a standalone Preact build
 *     (embed-player.js, ~15KB gzipped) for embedding on third-party sites
 */

"use client";

import { useState } from "react";
import { usePlayerSwap } from "./usePlayerSwap";

interface EmbedPlayerProps {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  posterUrl?: string;
  variantId: string;
  projectSlug: string;
}

export function EmbedPlayer({
  hookClipUrl,
  fullVideoUrl,
  hookEndTimeMs,
  posterUrl,
  variantId,
  projectSlug,
}: EmbedPlayerProps) {
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    hookRef,
    fullRef,
    phase,
    togglePlay,
    showHook,
    showFull,
  } = usePlayerSwap({
    hookClipUrl,
    fullVideoUrl,
    hookEndTimeMs,
    onPlay: () => {
      // Track play event
      trackEvent("play", variantId, projectSlug);
    },
    onProgress: (pct) => {
      // Track milestone events
      if (pct === 25 || pct === 50 || pct === 75) {
        trackEvent(`progress_${pct}`, variantId, projectSlug);
      }
    },
    onComplete: () => {
      trackEvent("complete", variantId, projectSlug);
    },
  });

  function handleClick() {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
    togglePlay();
  }

  return (
    <div
      className="wai-player-container"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        backgroundColor: "#000",
        overflow: "hidden",
        cursor: "pointer",
        borderRadius: "8px",
      }}
      onClick={handleClick}
    >
      {/* Hook clip player */}
      <video
        ref={hookRef}
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: showHook ? 1 : 0,
          pointerEvents: showHook ? "auto" : "none",
          transition: "opacity 0.05s",
        }}
      />

      {/* Full variant video player */}
      <video
        ref={fullRef}
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: showFull ? 1 : 0,
          pointerEvents: showFull ? "auto" : "none",
          transition: "opacity 0.05s",
        }}
      />

      {/* Play button overlay with poster frame */}
      {(phase === "idle" || (!hasInteracted && phase === "loading_hook")) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: posterUrl
              ? `url(${posterUrl}) center/contain no-repeat, #000`
              : "rgba(0,0,0,0.4)",
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
      )}

      {/* Loading spinner during swap */}
      {phase === "swapping" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "wai-spin 0.8s linear infinite",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes wai-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Simple event tracking
function trackEvent(event: string, variantId: string, projectSlug: string) {
  try {
    const body = JSON.stringify({
      event,
      variantId,
      projectSlug,
      timestamp: Date.now(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", body);
    } else {
      fetch("/api/track", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
    }
  } catch {
    // Tracking should never break the player
  }
}
