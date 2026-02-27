/**
 * SmartSyncPlayer.tsx — AI Smart Sync video player
 *
 * PURPOSE:
 *   The flagship player for webinar.ai. Uses parallel-playback architecture
 *   where BOTH the hook clip and full variant video play simultaneously from
 *   0:00. The hook plays visually with audio while the full video buffers
 *   hidden and muted. At swap time, it's just a visibility + audio toggle —
 *   zero seeking, zero glitch.
 *
 * WHY "AI SMART SYNC":
 *   The player intelligently synchronizes two video streams so the viewer
 *   perceives a single, instantly-loading video with no buffering gaps.
 *
 * VISUAL STATES:
 *   - Idle: Play button overlay on poster/black background
 *   - Playing hook: Hook clip visible, full video buffering hidden
 *   - Playing full: Full video visible, hook clip stopped
 *   - Ended: Full video shows last frame
 *
 * ARCHITECTURE:
 *   - Uses: useBigBrainSwap hook for parallel-playback state management
 *   - Same interface as EmbedPlayer (drop-in replacement)
 */

"use client";

import { useState } from "react";
import { useBigBrainSwap } from "./useBigBrainSwap";

interface SmartSyncPlayerProps {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  posterUrl?: string;
  variantId: string;
  projectSlug: string;
}

export function SmartSyncPlayer({
  hookClipUrl,
  fullVideoUrl,
  hookEndTimeMs,
  posterUrl,
  variantId,
  projectSlug,
}: SmartSyncPlayerProps) {
  const [hasInteracted, setHasInteracted] = useState(false);

  const { hookRef, fullRef, phase, togglePlay, showHook, showFull } =
    useBigBrainSwap({
      hookClipUrl,
      fullVideoUrl,
      hookEndTimeMs,
      onPlay: () => {
        trackEvent("play", variantId, projectSlug);
      },
      onProgress: (pct) => {
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
      {/* Hook clip player — visible during hook phase */}
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

      {/* Full variant video — plays hidden/muted until swap */}
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

      {/* Play button overlay */}
      {(phase === "idle" || (!hasInteracted && phase === "loading")) && (
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
    </div>
  );
}

// Simple event tracking (same as EmbedPlayer)
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
