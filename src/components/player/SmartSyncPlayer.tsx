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

import { useState, useEffect, useCallback } from "react";
import { useSmartSync } from "./useSmartSync";
import { PlayerControls } from "./PlayerControls";

// Version tag — check browser console or inspect data-wai-version to verify deploy
const WAI_VERSION = "smartsync-2.1";

interface SmartSyncPlayerProps {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  posterUrl?: string;
  variantId: string;
  projectSlug: string;
  /** Whether the hook clip has been fully preloaded as a blob */
  hookPreloaded?: boolean;
  /** HLS manifest URL for adaptive streaming (full video only) */
  hlsManifestUrl?: string;
}

export function SmartSyncPlayer({
  hookClipUrl,
  fullVideoUrl,
  hookEndTimeMs,
  posterUrl,
  variantId,
  projectSlug,
  hookPreloaded,
  hlsManifestUrl,
}: SmartSyncPlayerProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  // Keep poster overlay visible until the hook video has decoded its first frame
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useEffect(() => {
    console.log(
      `%c[webinar.ai]%c SmartSync ${WAI_VERSION} | early-swap + micro-crossfade + RVFC`,
      "color: #6366f1; font-weight: bold",
      "color: inherit"
    );
  }, []);

  const { hookRef, fullRef, phase, currentTime, duration, isPlaying, togglePlay } =
    useSmartSync({
      hookClipUrl,
      fullVideoUrl,
      hookEndTimeMs,
      hookPreloaded,
      hlsManifestUrl,
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

  // Detect when the hook video has decoded its first frame — only then hide poster
  useEffect(() => {
    const hook = hookRef.current;
    if (!hook) return;

    const onPlaying = () => {
      // 'playing' fires after the first frame is rendered — safe to remove poster
      setFirstFrameReady(true);
    };

    hook.addEventListener("playing", onPlaying);
    return () => hook.removeEventListener("playing", onPlaying);
  }, [hookRef]);

  const handleSeek = useCallback((time: number) => {
    const full = fullRef.current;
    if (full) {
      full.currentTime = time;
    }
  }, [fullRef]);

  function handleClick() {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
    togglePlay();
  }

  // Show the poster overlay when:
  // - Phase is idle (haven't started anything)
  // - OR user hasn't interacted yet and we're still loading
  // - OR user clicked play but hook hasn't rendered its first frame yet
  const showPoster =
    phase === "idle" ||
    (!hasInteracted && phase === "loading") ||
    (hasInteracted && !firstFrameReady && phase !== "playing_hook" && phase !== "playing_full");

  return (
    <div
      className="wai-player-container"
      data-wai-version={WAI_VERSION}
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
      {/* Full variant video — z-index managed by useSmartSync via DOM */}
      <video
        ref={fullRef}
        playsInline
        poster={posterUrl}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Hook clip player — z-index managed by useSmartSync via DOM */}
      <video
        ref={hookRef}
        playsInline
        poster={posterUrl}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Play button overlay — stays on top until first frame is decoded */}
      {showPoster && (
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
          {/* Show play button only before interaction, show spinner after click */}
          {!hasInteracted ? (
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
          ) : (
            /* Loading spinner while waiting for first frame after click */
            <div
              style={{
                width: 48,
                height: 48,
                border: "3px solid rgba(255,255,255,0.3)",
                borderTopColor: "rgba(255,255,255,0.9)",
                borderRadius: "50%",
                animation: "wai-spin 0.8s linear infinite",
              }}
            />
          )}
        </div>
      )}

      {/* Player controls (progress bar + scrub) */}
      {hasInteracted && firstFrameReady && (
        <PlayerControls
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={togglePlay}
        />
      )}

      {/* Spinner animation */}
      <style>{`@keyframes wai-spin { to { transform: rotate(360deg); } }`}</style>
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
