/**
 * SimpleMobilePlayer.tsx — Single-video player for mobile devices
 *
 * PURPOSE:
 *   Mobile devices can't reliably decode two H.264 streams simultaneously.
 *   This player uses a SINGLE <video> element playing the full stitched
 *   variant directly. Optimized for instant perceived start on mobile.
 *
 * FEATURES:
 *   - Canvas poster bridge (zero-gap poster → video transition)
 *   - Micro-segment turbo start (toggle via ?turbo=1 URL param)
 *   - Tap feedback (play/pause icon flash on tap)
 *   - Page Visibility API (pause when backgrounded, resume on return)
 *   - Stall recovery (detect buffering, show spinner, auto-recover)
 *   - Resume on return (localStorage — pick up where you left off)
 *   - Tracking events (play, progress milestones, complete)
 *
 * CANVAS POSTER BRIDGE:
 *   Instead of a CSS background-image overlay that causes a visible flash
 *   when swapped for the video, we draw the poster on a <canvas> element.
 *   When the video starts, we draw the first video frame onto the same
 *   canvas, then hide the canvas — resulting in a seamless transition.
 *
 * MICRO-SEGMENT TURBO START (?turbo=1):
 *   When enabled, the first 1.5 seconds of the video are blob-preloaded
 *   as a tiny standalone MP4 (~50-200KB). On play, this micro-segment
 *   plays instantly. Near the end, the canvas bridges the swap to the
 *   full video at the 1.5s mark. Result: instant perceived playback.
 *
 * WHEN TO USE:
 *   - Mobile devices (80% of traffic)
 *   - SmartSyncPlayer is used on desktop where dual-video works well
 */

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useHls } from "./useHls";

const WAI_VERSION = "mobile-2.0";
const MICRO_SEGMENT_DURATION_SEC = 1.5;
const MICRO_SWAP_TRIGGER_SEC = 1.2; // Start swap slightly before end

interface SimpleMobilePlayerProps {
  fullVideoUrl: string;
  posterUrl?: string;
  variantId: string;
  projectSlug: string;
  microSegmentUrl?: string;
  hlsManifestUrl?: string;
}

/** localStorage key for resume position */
function resumeKey(variantId: string): string {
  return `wai_resume_${variantId}`;
}

export function SimpleMobilePlayer({
  fullVideoUrl,
  posterUrl,
  variantId,
  projectSlug,
  microSegmentUrl,
  hlsManifestUrl,
}: SimpleMobilePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { attachHls, detachHls } = useHls();

  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);
  const [isStalled, setIsStalled] = useState(false);
  const [tapIcon, setTapIcon] = useState<"play" | "pause" | null>(null);
  const [canvasBridgeActive, setCanvasBridgeActive] = useState(true);

  const progressFiredRef = useRef<Set<number>>(new Set());
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingBeforeHiddenRef = useRef(false);
  const resumeTimeRef = useRef<number>(0);
  const microBlobUrlRef = useRef<string | null>(null);
  const swapTriggeredRef = useRef(false);
  const isTurboRef = useRef(false);

  const turboMode = !!microSegmentUrl;

  useEffect(() => {
    console.log(
      `%c[webinar.ai]%c SimpleMobilePlayer ${WAI_VERSION}${turboMode ? " [turbo]" : ""}`,
      "color: #6366f1; font-weight: bold",
      "color: inherit"
    );
  }, [turboMode]);

  // ─── Canvas: draw poster image on mount ───
  useEffect(() => {
    if (!posterUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = posterUrl;
  }, [posterUrl]);

  // ─── Micro-segment: blob preload ───
  useEffect(() => {
    if (!microSegmentUrl) return;

    fetch(microSegmentUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        microBlobUrlRef.current = url;
        isTurboRef.current = true;

        // Set micro-segment as initial video source
        const video = videoRef.current;
        if (video && !hasInteracted) {
          video.src = url;
          video.preload = "auto";
        }
      })
      .catch(() => {
        // Fall back to normal mode if preload fails
      });

    return () => {
      if (microBlobUrlRef.current) {
        URL.revokeObjectURL(microBlobUrlRef.current);
        microBlobUrlRef.current = null;
      }
    };
  }, [microSegmentUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resume position: check on mount ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem(resumeKey(variantId));
      if (saved) {
        const time = parseFloat(saved);
        if (time > 5 && isFinite(time)) {
          resumeTimeRef.current = time;
          // If resuming, skip turbo start (they're past the first 1.5s)
          isTurboRef.current = false;
        }
      }
    } catch {
      // localStorage may be unavailable
    }
  }, [variantId]);

  // ─── Resume position: save periodically while playing ───
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      try {
        localStorage.setItem(
          resumeKey(variantId),
          String(Math.floor(video.currentTime))
        );
      } catch {
        // Ignore storage errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, variantId]);

  // ─── Page Visibility API: pause when backgrounded ───
  useEffect(() => {
    const onVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;

      if (document.hidden) {
        wasPlayingBeforeHiddenRef.current = !video.paused;
        if (!video.paused) {
          video.pause();
        }
      } else {
        if (wasPlayingBeforeHiddenRef.current) {
          video.play().catch(() => {});
          wasPlayingBeforeHiddenRef.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // ─── Video events: tracking, stall detection, turbo swap, canvas bridge ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!video.duration) return;

      // Turbo swap: when micro-segment approaches end, swap to full video
      if (
        isTurboRef.current &&
        !swapTriggeredRef.current &&
        video.currentTime >= MICRO_SWAP_TRIGGER_SEC
      ) {
        swapTriggeredRef.current = true;
        performTurboSwap(video);
        return;
      }

      // Progress tracking (use full video duration, not micro-segment)
      // Skip tracking during micro-segment playback
      if (isTurboRef.current) return;

      const pct = Math.round((video.currentTime / video.duration) * 100);
      for (const milestone of [25, 50, 75]) {
        if (pct >= milestone && !progressFiredRef.current.has(milestone)) {
          progressFiredRef.current.add(milestone);
          trackEvent(`progress_${milestone}`, variantId, projectSlug);
        }
      }
    };

    const onEnded = () => {
      // If micro-segment ended naturally (shouldn't happen — swap triggers first)
      if (isTurboRef.current && !swapTriggeredRef.current) {
        swapTriggeredRef.current = true;
        performTurboSwap(video);
        return;
      }

      setIsPlaying(false);
      trackEvent("complete", variantId, projectSlug);
      try {
        localStorage.removeItem(resumeKey(variantId));
      } catch {
        // Ignore
      }
    };

    const onPlaying = () => {
      setShowPlayButton(false);
      setIsPlaying(true);
      setIsStalled(false);

      // Canvas bridge: draw first video frame to canvas, then hide canvas
      if (canvasBridgeActive) {
        drawVideoFrameToCanvas(video);
        requestAnimationFrame(() => {
          setCanvasBridgeActive(false);
        });
      }
    };

    const onWaiting = () => {
      setIsStalled(true);
    };

    // Stall recovery: nudge playback after 10s of stalling
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const onWaitingRecovery = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (video.readyState < 3 && !video.paused) {
          const currentPos = video.currentTime;
          video.load();
          video.currentTime = currentPos;
          video.play().catch(() => {});
        }
      }, 10000);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("waiting", onWaitingRecovery);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("waiting", onWaitingRecovery);
      if (stallTimer) clearTimeout(stallTimer);
    };
  }, [variantId, projectSlug, canvasBridgeActive, fullVideoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Turbo swap: transition from micro-segment to full video.
   * 1. Capture current video frame to canvas (visual bridge)
   * 2. Show canvas over video
   * 3. Swap video src to full URL and seek to 1.5s
   * 4. When full video is ready, play and hide canvas
   */
  const performTurboSwap = useCallback(
    async (video: HTMLVideoElement) => {
      // Step 1: draw current frame to canvas as visual bridge
      drawVideoFrameToCanvas(video);
      setCanvasBridgeActive(true);

      // Step 2: swap video source to full URL (HLS if available, else MP4)
      video.pause();

      if (hlsManifestUrl) {
        await attachHls(video, hlsManifestUrl, fullVideoUrl, MICRO_SEGMENT_DURATION_SEC);
      } else {
        video.src = fullVideoUrl;
        video.currentTime = MICRO_SEGMENT_DURATION_SEC;
      }

      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        isTurboRef.current = false;
        video
          .play()
          .then(() => {
            // Step 3: hide canvas to reveal full video
            requestAnimationFrame(() => {
              setCanvasBridgeActive(false);
            });
          })
          .catch(() => {
            setCanvasBridgeActive(false);
          });
      };

      video.addEventListener("canplay", onCanPlay);
      if (!hlsManifestUrl) {
        video.load();
      }
    },
    [fullVideoUrl, hlsManifestUrl, attachHls] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Draw the current video frame onto the canvas for seamless bridging */
  const drawVideoFrameToCanvas = useCallback(
    (video: HTMLVideoElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Use video's native dimensions for accurate frame capture
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    },
    []
  );

  // ─── Tap feedback icon ───
  const flashTapIcon = useCallback((icon: "play" | "pause") => {
    setTapIcon(icon);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapIcon(null), 500);
  }, []);

  // ─── Click handler ───
  const handleClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!hasInteracted) {
      setHasInteracted(true);

      // Resume from saved position if available (skips turbo)
      if (resumeTimeRef.current > 0) {
        isTurboRef.current = false;
        const resumePos = resumeTimeRef.current;
        resumeTimeRef.current = 0;

        if (hlsManifestUrl) {
          attachHls(video, hlsManifestUrl, fullVideoUrl, resumePos).then(() => {
            video.play().then(() => {
              trackEvent("play", variantId, projectSlug);
            }).catch(() => setHasInteracted(false));
          });
          return;
        } else {
          video.src = fullVideoUrl;
          video.currentTime = resumePos;
        }
      } else if (!isTurboRef.current && hlsManifestUrl) {
        // Normal first play with HLS (no turbo, no resume)
        attachHls(video, hlsManifestUrl, fullVideoUrl).then(() => {
          video.play().then(() => {
            trackEvent("play", variantId, projectSlug);
          }).catch(() => setHasInteracted(false));
        });
        return;
      }

      video
        .play()
        .then(() => {
          trackEvent("play", variantId, projectSlug);
        })
        .catch(() => {
          setHasInteracted(false);
        });
      return;
    }

    if (video.paused) {
      video.play();
      setIsPlaying(true);
      flashTapIcon("play");
    } else {
      video.pause();
      setIsPlaying(false);
      flashTapIcon("pause");
    }
  }, [hasInteracted, variantId, projectSlug, flashTapIcon, fullVideoUrl, hlsManifestUrl, attachHls]);

  // ─── Cleanup HLS instance on unmount ───
  useEffect(() => {
    return () => { detachHls(); };
  }, [detachHls]);

  return (
    <div
      className="wai-player-container"
      data-wai-version={WAI_VERSION}
      data-wai-turbo={turboMode ? "1" : "0"}
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
      {/* Video element — hidden behind canvas until first frame renders */}
      <video
        ref={videoRef}
        src={hlsManifestUrl ? undefined : fullVideoUrl}
        preload="auto"
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Canvas poster bridge — seamless poster → video transition.
          Draws poster image initially, then draws first video frame
          before hiding. Eliminates the visible flash of CSS overlays. */}
      {canvasBridgeActive && (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 5,
          }}
        />
      )}

      {/* Play button overlay — shown until first play */}
      {showPlayButton && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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

      {/* Buffering spinner — shown when video stalls mid-playback */}
      {isStalled && !showPlayButton && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
        >
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
        </div>
      )}

      {/* Tap feedback — brief play/pause icon flash */}
      {tapIcon && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "wai-tap-fade 0.5s ease-out forwards",
            }}
          >
            {tapIcon === "play" ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <rect x="5" y="3" width="4" height="18" />
                <rect x="15" y="3" width="4" height="18" />
              </svg>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wai-spin { to { transform: rotate(360deg); } }
        @keyframes wai-tap-fade {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
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
