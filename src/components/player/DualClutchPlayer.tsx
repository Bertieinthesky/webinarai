/**
 * DualClutchPlayer.tsx — Seamless single-video player using combined HLS manifests
 *
 * PURPOSE:
 *   Plays hook → body → CTA through a SINGLE <video> element by loading a
 *   combined HLS manifest with #EXT-X-DISCONTINUITY tags between segments.
 *   hls.js handles decoder reinitialization at boundaries and buffers ahead
 *   automatically — like a dual-clutch transmission pre-spooling the next gear.
 *
 * WHY THIS IS BETTER:
 *   - No stitching needed (no PTS discontinuities in the file)
 *   - No dual-video swap (no glitch window)
 *   - Single <video> element (simplest possible player)
 *   - hls.js pre-buffers the next segment automatically
 *   - Seek/scrub works across segment boundaries natively
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useHls } from "./useHls";
import { PlayerControls } from "./PlayerControls";

const WAI_DC_VERSION = "dualclutch-1.0";

interface DualClutchPlayerProps {
  manifestUrl: string;
  mp4FallbackUrl: string;
  posterUrl?: string;
  variantId: string;
  projectSlug: string;
  /** Segment durations in ms: [hook, body, cta] — used for boundary markers */
  segmentDurationsMs?: number[];
}

export function DualClutchPlayer({
  manifestUrl,
  mp4FallbackUrl,
  posterUrl,
  variantId,
  projectSlug,
  segmentDurationsMs,
}: DualClutchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { attachHls, detachHls } = useHls();
  const progressTrackedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    console.log(
      `%c[webinar.ai]%c DualClutch ${WAI_DC_VERSION} | single-video HLS + discontinuity`,
      "color: #6366f1; font-weight: bold",
      "color: inherit"
    );
  }, []);

  // Attach HLS when component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    attachHls(video, manifestUrl, mp4FallbackUrl);

    return () => {
      detachHls();
    };
  }, [manifestUrl, mp4FallbackUrl, attachHls, detachHls]);

  // Track time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Progress tracking
      if (video.duration > 0) {
        const pct = Math.floor((video.currentTime / video.duration) * 100);
        for (const milestone of [25, 50, 75]) {
          if (pct >= milestone && !progressTrackedRef.current.has(milestone)) {
            progressTrackedRef.current.add(milestone);
            trackEvent(`progress_${milestone}`, variantId, projectSlug);
          }
        }
      }
    };

    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const onPlaying = () => {
      setIsPlaying(true);
      setFirstFrameReady(true);
    };

    const onPause = () => setIsPlaying(false);

    const onEnded = () => {
      setIsPlaying(false);
      trackEvent("complete", variantId, projectSlug);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [variantId, projectSlug]);

  // Page Visibility: pause when tab is backgrounded to prevent decoder
  // corruption at discontinuity boundaries and save bandwidth/battery
  useEffect(() => {
    const handleVisibility = () => {
      const video = videoRef.current;
      if (!video || !hasInteracted) return;

      if (document.hidden && !video.paused) {
        video.pause();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [hasInteracted]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!hasInteracted) {
      setHasInteracted(true);
      trackEvent("play", variantId, projectSlug);
    }

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hasInteracted, variantId, projectSlug]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  // Build segment boundary markers from durations
  const segmentBoundaries = segmentDurationsMs
    ? (() => {
        const boundaries: { time: number; label: string }[] = [];
        const labels = ["Hook", "Body", "CTA"];
        let cumulative = 0;
        for (let i = 0; i < segmentDurationsMs.length - 1; i++) {
          cumulative += segmentDurationsMs[i] / 1000;
          boundaries.push({ time: cumulative, label: `${labels[i]} → ${labels[i + 1]}` });
        }
        return boundaries;
      })()
    : undefined;

  const showPoster = !hasInteracted || !firstFrameReady;

  return (
    <div
      className="wai-player-container"
      data-wai-version={WAI_DC_VERSION}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        backgroundColor: "#000",
        overflow: "hidden",
        cursor: "pointer",
        borderRadius: "8px",
      }}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        playsInline
        poster={posterUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Play button / loading overlay */}
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

      {/* Player controls */}
      {hasInteracted && firstFrameReady && (
        <PlayerControls
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={togglePlay}
          segmentBoundaries={segmentBoundaries}
        />
      )}

      <style>{`@keyframes wai-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
