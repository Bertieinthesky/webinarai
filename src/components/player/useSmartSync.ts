/**
 * useSmartSync.ts — AI Smart Sync parallel-playback hook (zero-seek swap)
 *
 * PURPOSE:
 *   Eliminates the hook-to-body swap glitch by playing BOTH videos from 0:00
 *   simultaneously. The hook clip plays visually with audio while the full
 *   variant video plays underneath (same opacity, lower z-index). When the
 *   hook ends, swap is just a z-index flip + audio toggle — no seeking needed.
 *
 * KEY INSIGHT — Z-INDEX NOT OPACITY:
 *   Using opacity:0 to "hide" the full video causes browsers to throttle its
 *   decoder, so frames aren't ready at swap time. Instead, both videos render
 *   at opacity:1 and the hook simply sits ON TOP via z-index. The browser
 *   actively decodes both because both are "visible." Swap = flip z-index.
 *
 * BANDWIDTH OPTIMIZATION (v2.2):
 *   On mobile, loading both videos simultaneously splits bandwidth and causes
 *   the full video to buffer too slowly. New approach:
 *   1. Set full video src on mount but preload="none" (no download)
 *   2. On play click: start hook immediately, then start full video
 *   3. If hook is blob-preloaded, it plays from memory (zero bandwidth),
 *      giving 100% of bandwidth to the full video for buffering
 *   4. Monitor full video buffer health — if it hasn't buffered past the
 *      hook duration by swap time, extend the hook or wait
 *
 * FRAME-LEVEL SYNC (requestVideoFrameCallback):
 *   Uses the browser's requestVideoFrameCallback API to get exact media
 *   presentation timestamps for each frame. Compares both videos' mediaTime
 *   on every frame and applies micro playbackRate corrections if drift exceeds
 *   33ms (~1 frame at 30fps). Falls back to 500ms interval polling for older
 *   browsers that don't support the API.
 *
 * STATE MACHINE:
 *   idle → loading → playing_hook → playing_full → ended
 *                                      ↕
 *                                    paused
 *   Any state → error (on network/decode failure)
 */

"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useHls } from "./useHls";

export type SmartSyncPhase =
  | "idle"
  | "loading"
  | "playing_hook"
  | "playing_full"
  | "paused"
  | "ended"
  | "error";

interface UseSmartSyncOptions {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  /** Whether the hook clip has been fully preloaded as a blob */
  hookPreloaded?: boolean;
  /** HLS manifest URL for adaptive streaming (full video only) */
  hlsManifestUrl?: string;
  onPlay?: () => void;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

// Check for requestVideoFrameCallback support
function supportsRVFC(el: HTMLVideoElement): boolean {
  return "requestVideoFrameCallback" in el;
}

/**
 * Check if a video has buffered enough to play through a given time.
 * Returns the furthest buffered time from the current position.
 */
function getBufferedAhead(video: HTMLVideoElement): number {
  const buffered = video.buffered;
  const current = video.currentTime;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= current && buffered.end(i) > current) {
      return buffered.end(i) - current;
    }
  }
  return 0;
}

export function useSmartSync({
  hookClipUrl,
  fullVideoUrl,
  hookPreloaded,
  hlsManifestUrl,
  onPlay,
  onProgress,
  onComplete,
}: UseSmartSyncOptions) {
  const hookRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);
  const { attachHls, detachHls } = useHls();
  const [phase, setPhase] = useState<SmartSyncPhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const swappedRef = useRef(false);
  const syncActiveRef = useRef(false);
  const hookRvfcHandle = useRef<number | null>(null);
  const fullRvfcHandle = useRef<number | null>(null);
  const hookMediaTimeRef = useRef(0);
  const fullMediaTimeRef = useRef(0);
  const driftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Active player is whichever is currently on top
  const activeRef = useMemo(
    () => (phase === "playing_full" || phase === "ended" ? fullRef : hookRef),
    [phase]
  );

  // Load sources on mount
  // KEY CHANGE (v2.2): Hook loads immediately with preload="auto".
  // Full video gets its src set but preload="none" — it won't download
  // anything until we explicitly call .load() when the user clicks play.
  // This gives all bandwidth to the hook clip for instant preloading.
  useEffect(() => {
    if (!hookClipUrl || !fullVideoUrl) return;

    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    swappedRef.current = false;
    syncActiveRef.current = false;

    // Set initial z-index and opacity via DOM (hook on top, full underneath)
    hook.style.zIndex = "2";
    hook.style.opacity = "1";
    hook.style.transition = "";
    full.style.zIndex = "1";
    full.style.opacity = "1";
    full.style.transition = "";

    // Hook: load immediately (small file, or blob-preloaded)
    hook.src = hookClipUrl;
    hook.preload = "auto";
    hook.load();

    // Full: set src but DON'T download yet — save bandwidth for hook
    // When HLS is available, don't set src at all — attachHls will handle it on play
    if (!hlsManifestUrl) {
      full.src = fullVideoUrl;
    }
    full.preload = "none";
    full.muted = true;
    // Don't call full.load() — we'll do that on play click

    setPhase("loading");

    return () => { detachHls(); };
  }, [hookClipUrl, fullVideoUrl, hlsManifestUrl, detachHls]);

  // Swap function — extracted so it can be called from RVFC (early) or ended (fallback)
  const doSwapRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    const doSwap = () => {
      if (swappedRef.current) return;
      swappedRef.current = true;
      syncActiveRef.current = false;

      // Stop all sync mechanisms
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
        driftIntervalRef.current = null;
      }
      if (hookRvfcHandle.current !== null && supportsRVFC(hook)) {
        hook.cancelVideoFrameCallback(hookRvfcHandle.current);
        hookRvfcHandle.current = null;
      }
      if (fullRvfcHandle.current !== null && supportsRVFC(full)) {
        full.cancelVideoFrameCallback(fullRvfcHandle.current);
        fullRvfcHandle.current = null;
      }

      // Reset playback rate
      full.playbackRate = 1.0;

      // === CRITICAL: All swap mutations must be synchronous ===
      // Direct DOM manipulation ensures visual + audio swap happen
      // in the SAME JS execution frame, before the browser paints.

      // Micro-crossfade: briefly show both at full opacity with the full
      // video on top. The 80ms transition masks any sub-frame visual
      // difference between the two encodings.
      full.style.transition = "opacity 0.08s";
      hook.style.transition = "opacity 0.08s";
      full.style.zIndex = "3";
      full.style.opacity = "1";
      hook.style.zIndex = "0";

      // Audio swap
      full.muted = false;
      hook.muted = true;

      // Fade out hook after crossfade completes
      setTimeout(() => {
        hook.style.opacity = "0";
        hook.pause();
      }, 80);

      // React state update for UI consistency (NOT for the swap itself)
      setPhase("playing_full");
      if (full.duration) {
        setDuration(full.duration);
      }
    };

    doSwapRef.current = doSwap;

    // Fallback: if RVFC early-swap didn't trigger, swap on ended
    hook.addEventListener("ended", doSwap);
    return () => hook.removeEventListener("ended", doSwap);
  }, []);

  // Frame-level sync using requestVideoFrameCallback
  // Falls back to interval-based drift correction for unsupported browsers
  useEffect(() => {
    if (phase !== "playing_hook") {
      syncActiveRef.current = false;
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
        driftIntervalRef.current = null;
      }
      return;
    }

    syncActiveRef.current = true;
    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    if (supportsRVFC(hook) && supportsRVFC(full)) {
      // --- Frame-accurate sync via requestVideoFrameCallback ---
      // Track each video's exact media presentation time on every frame.
      // Compare them and apply micro playbackRate corrections.

      let initialSyncDone = false;

      const correctDrift = () => {
        if (!syncActiveRef.current) return;

        const hookTime = hookMediaTimeRef.current;
        const fullTime = fullMediaTimeRef.current;

        // Only correct once both have reported at least one frame
        if (hookTime === 0 && fullTime === 0) return;

        const drift = hookTime - fullTime; // positive = full is behind

        // Initial sync: if drift is large on first check (blob preload head start),
        // force-seek the full video to match rather than slowly correcting
        if (!initialSyncDone && Math.abs(drift) > 0.1) {
          full.currentTime = hook.currentTime;
          initialSyncDone = true;
          return;
        }
        initialSyncDone = true;

        if (drift > 0.033) {
          // Full is >1 frame behind — speed up
          const rate = drift > 0.15 ? 1.08 : drift > 0.066 ? 1.04 : 1.02;
          full.playbackRate = rate;
        } else if (drift < -0.033) {
          // Full is ahead — slow down
          const rate = drift < -0.15 ? 0.92 : drift < -0.066 ? 0.96 : 0.98;
          full.playbackRate = rate;
        } else if (full.playbackRate !== 1.0) {
          // Within 1 frame tolerance — normalize
          full.playbackRate = 1.0;
        }
      };

      // Recursive frame callback for hook video
      const onHookFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        hookMediaTimeRef.current = metadata.mediaTime;
        correctDrift();

        // Early swap: trigger 150ms BEFORE hook ends to avoid the
        // ended-state frame artifact. At this point both videos are
        // still actively playing the same content — swap is invisible.
        //
        // BUFFER CHECK (v2.2): Only swap if full video has buffered
        // enough frames ahead. If not, let the hook play to its end
        // and the 'ended' fallback will handle the swap.
        if (
          hook.duration > 0 &&
          metadata.mediaTime >= hook.duration - 0.15 &&
          !swappedRef.current &&
          doSwapRef.current
        ) {
          const fullBufferAhead = getBufferedAhead(full);
          if (fullBufferAhead >= 1.0) {
            // Full video has at least 1s of buffer ahead — safe to swap
            doSwapRef.current();
            return; // Don't schedule another frame callback
          }
          // Otherwise, let hook play to end — 'ended' fallback will swap
        }

        if (syncActiveRef.current) {
          hookRvfcHandle.current = hook.requestVideoFrameCallback(onHookFrame);
        }
      };

      // Recursive frame callback for full video
      const onFullFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        fullMediaTimeRef.current = metadata.mediaTime;
        correctDrift();
        if (syncActiveRef.current) {
          fullRvfcHandle.current = full.requestVideoFrameCallback(onFullFrame);
        }
      };

      hookRvfcHandle.current = hook.requestVideoFrameCallback(onHookFrame);
      fullRvfcHandle.current = full.requestVideoFrameCallback(onFullFrame);

      return () => {
        syncActiveRef.current = false;
        if (hookRvfcHandle.current !== null) {
          hook.cancelVideoFrameCallback(hookRvfcHandle.current);
          hookRvfcHandle.current = null;
        }
        if (fullRvfcHandle.current !== null) {
          full.cancelVideoFrameCallback(fullRvfcHandle.current);
          fullRvfcHandle.current = null;
        }
      };
    } else {
      // --- Fallback: interval-based drift correction ---
      driftIntervalRef.current = setInterval(() => {
        if (!syncActiveRef.current) return;
        if (hook.paused || full.paused) return;

        // Early swap with buffer check (same as RVFC path)
        if (
          hook.duration > 0 &&
          hook.currentTime >= hook.duration - 0.15 &&
          !swappedRef.current &&
          doSwapRef.current
        ) {
          const fullBufferAhead = getBufferedAhead(full);
          if (fullBufferAhead >= 1.0) {
            doSwapRef.current();
            return;
          }
        }

        const drift = hook.currentTime - full.currentTime;

        if (drift > 0.3) {
          full.playbackRate = 1.05;
        } else if (drift < -0.3) {
          full.playbackRate = 0.95;
        } else if (full.playbackRate !== 1.0) {
          full.playbackRate = 1.0;
        }
      }, 500);

      return () => {
        syncActiveRef.current = false;
        if (driftIntervalRef.current) {
          clearInterval(driftIntervalRef.current);
          driftIntervalRef.current = null;
        }
      };
    }
  }, [phase]);

  // Track current time and progress milestones
  useEffect(() => {
    if (phase !== "playing_hook" && phase !== "playing_full") {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      const active = activeRef.current;
      if (!active) return;

      const time = active.currentTime;
      setCurrentTime(time);

      const dur =
        phase === "playing_full" ? fullRef.current?.duration || 0 : 0;
      if (dur > 0) {
        const pct = Math.round((time / dur) * 100);
        onProgress?.(pct);
      }
    }, 250);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [phase, activeRef, onProgress]);

  // Full video ended
  useEffect(() => {
    const full = fullRef.current;
    if (!full) return;

    const handleEnded = () => {
      setPhase("ended");
      onComplete?.();
    };

    full.addEventListener("ended", handleEnded);
    return () => full.removeEventListener("ended", handleEnded);
  }, [onComplete]);

  // Play/pause toggle — the core interaction
  const togglePlay = useCallback(() => {
    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    if (phase === "idle" || phase === "loading") {
      // First click: start BOTH videos simultaneously
      swappedRef.current = false;
      hookMediaTimeRef.current = 0;
      fullMediaTimeRef.current = 0;

      // Full video plays muted underneath from 0:00
      full.muted = true;
      full.currentTime = 0;

      // Hook plays with audio on top
      hook.currentTime = 0;

      // KEY CHANGE (v2.2): Now load the full video.
      // We deferred loading until play click so the hook clip got all
      // bandwidth during page load. If the hook was blob-preloaded,
      // the full video now gets 100% of bandwidth.
      if (hlsManifestUrl) {
        // HLS: attach via hls.js (Chrome/Firefox) or native (Safari)
        attachHls(full, hlsManifestUrl, fullVideoUrl);
      } else {
        full.preload = "auto";
        full.load();
      }

      // Start hook first — it's preloaded (blob or cached), so it plays instantly.
      // Start full video after a short delay to let its metadata load.
      const hookPlay = hook.play();

      hookPlay
        .then(() => {
          setPhase("playing_hook");
          onPlay?.();

          // Start full video after hook is playing.
          // The hook is already rendering frames, so the poster is gone
          // and the viewer sees video. Full video loads underneath.
          full.play().catch(() => {
            // If full video can't play yet (still loading metadata),
            // wait for canplay event then start
            const onCanPlay = () => {
              full.play().catch(() => {});
              full.removeEventListener("canplay", onCanPlay);
            };
            full.addEventListener("canplay", onCanPlay);
          });
        })
        .catch(() => {
          // Autoplay blocked — try again (some browsers need user gesture)
          hook
            .play()
            .then(() => {
              setPhase("playing_hook");
              onPlay?.();
              full.play().catch(() => {});
            })
            .catch(() => {
              setPhase("idle");
            });
        });
      return;
    }

    if (phase === "playing_hook") {
      hook.pause();
      full.pause();
      setPhase("paused");
      return;
    }

    if (phase === "playing_full") {
      full.pause();
      setPhase("paused");
      return;
    }

    if (phase === "paused") {
      if (swappedRef.current) {
        full.play().then(() => setPhase("playing_full"));
      } else {
        hook.play();
        full.play();
        setPhase("playing_hook");
      }
      return;
    }

    if (phase === "ended") {
      swappedRef.current = false;
      hookMediaTimeRef.current = 0;
      fullMediaTimeRef.current = 0;
      hook.currentTime = 0;
      full.currentTime = 0;
      full.muted = true;
      hook.muted = false;
      // Reset z-index and opacity via DOM for replay
      hook.style.zIndex = "2";
      hook.style.opacity = "1";
      hook.style.transition = "";
      full.style.zIndex = "1";
      full.style.opacity = "1";
      full.style.transition = "";

      hook.play();
      full.play();
      setPhase("playing_hook");
      onPlay?.();
    }
  }, [phase, onPlay, hlsManifestUrl, fullVideoUrl, attachHls]);

  return {
    hookRef,
    fullRef,
    phase,
    currentTime,
    duration,
    togglePlay,
    isPlaying: phase === "playing_hook" || phase === "playing_full",
  };
}
