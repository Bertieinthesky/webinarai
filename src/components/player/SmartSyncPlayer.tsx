/**
 * SmartSyncPlayer.tsx — AI Smart Sync video player
 *
 * PURPOSE:
 *   The flagship player for webinar.ai. Uses parallel-playback architecture
 *   where BOTH the hook clip and full variant video play simultaneously from
 *   0:00. Both render at full opacity (so the browser decodes both actively).
 *   The hook sits on top via z-index; at swap time, z-index flips and audio
 *   toggles. Zero seeking, zero decoder throttling, zero glitch.
 *
 * KEY: Z-INDEX NOT OPACITY
 *   Using opacity:0 causes browsers to throttle the hidden video's decoder.
 *   With z-index stacking, both videos are "visible" to the browser, so both
 *   get full decoder priority. The hook simply covers the full video visually.
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

  const { hookRef, fullRef, phase, togglePlay, hookOnTop } =
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
      {/* Full variant video — plays underneath during hook, on top after swap */}
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
          zIndex: hookOnTop ? 1 : 3,
        }}
      />

      {/* Hook clip player — sits on top during hook phase */}
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
          zIndex: hookOnTop ? 2 : 0,
        }}
      />

      {/* Play button overlay — always on top */}
      {(phase === "idle" || (!hasInteracted && phase === "loading")) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
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
