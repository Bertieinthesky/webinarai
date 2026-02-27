/**
 * useBigBrainSwap.ts — Parallel-playback dual-player hook (zero-seek swap)
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
 * DRIFT CORRECTION:
 *   If the full video stalls (buffering on slow connections), it may fall
 *   behind the hook. We monitor drift every 500ms and if the full video is
 *   >300ms behind, we briefly bump its playbackRate to 1.05x to catch up.
 *
 * STATE MACHINE:
 *   idle → loading → playing_hook → playing_full → ended
 *                                      ↕
 *                                    paused
 *   Any state → error (on network/decode failure)
 */

"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";

export type BigBrainPhase =
  | "idle"
  | "loading"
  | "playing_hook"
  | "playing_full"
  | "paused"
  | "ended"
  | "error";

interface UseBigBrainSwapOptions {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  onPlay?: () => void;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

export function useBigBrainSwap({
  hookClipUrl,
  fullVideoUrl,
  onPlay,
  onProgress,
  onComplete,
}: UseBigBrainSwapOptions) {
  const hookRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<BigBrainPhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const swappedRef = useRef(false);
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
  useEffect(() => {
    if (!hookClipUrl || !fullVideoUrl) return;

    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    swappedRef.current = false;

    // Set sources — both start at 0:00
    hook.src = hookClipUrl;
    hook.preload = "auto";
    hook.load();

    full.src = fullVideoUrl;
    full.preload = "auto";
    full.muted = true; // Full video plays muted until swap
    full.load();

    setPhase("loading");
  }, [hookClipUrl, fullVideoUrl]);

  // Hook ended → swap to full video
  useEffect(() => {
    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    const doSwap = () => {
      if (swappedRef.current) return;
      swappedRef.current = true;

      // Stop drift correction
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
        driftIntervalRef.current = null;
      }

      // Reset playback rate in case drift correction bumped it
      full.playbackRate = 1.0;

      // Unmute full video, mute + pause hook
      full.muted = false;
      hook.muted = true;
      hook.pause();

      // The full video is already playing at the right timestamp
      setPhase("playing_full");
      if (full.duration) {
        setDuration(full.duration);
      }
    };

    // Listen for hook's natural end
    hook.addEventListener("ended", doSwap);

    return () => {
      hook.removeEventListener("ended", doSwap);
    };
  }, []);

  // Drift correction: keep full video in sync with hook during parallel playback
  useEffect(() => {
    if (phase !== "playing_hook") {
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
        driftIntervalRef.current = null;
      }
      return;
    }

    driftIntervalRef.current = setInterval(() => {
      const hook = hookRef.current;
      const full = fullRef.current;
      if (!hook || !full || hook.paused || full.paused) return;

      const drift = hook.currentTime - full.currentTime;

      if (drift > 0.3) {
        // Full video is behind — speed it up slightly to catch up
        full.playbackRate = 1.05;
      } else if (drift < -0.3) {
        // Full video is ahead — slow it down slightly
        full.playbackRate = 0.95;
      } else if (full.playbackRate !== 1.0) {
        // Back in sync — normalize
        full.playbackRate = 1.0;
      }
    }, 500);

    return () => {
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
      }
    };
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

      // Full video plays muted underneath from 0:00
      full.muted = true;
      full.currentTime = 0;

      // Hook plays with audio on top
      hook.currentTime = 0;

      // Play both — hook audio is what the viewer hears
      const hookPlay = hook.play();
      const fullPlay = full.play();

      Promise.all([hookPlay, fullPlay])
        .then(() => {
          setPhase("playing_hook");
          onPlay?.();
        })
        .catch(() => {
          // Autoplay may be blocked — try just the hook
          hook
            .play()
            .then(() => {
              setPhase("playing_hook");
              onPlay?.();
              // Try full video again after user gesture
              full.play().catch(() => {
                // Will retry on swap
              });
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
      // Resume whichever was active
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
      // Restart from beginning
      swappedRef.current = false;
      hook.currentTime = 0;
      full.currentTime = 0;
      full.muted = true;
      hook.muted = false;

      hook.play();
      full.play();
      setPhase("playing_hook");
      onPlay?.();
    }
  }, [phase, onPlay]);

  return {
    hookRef,
    fullRef,
    phase,
    currentTime,
    duration,
    togglePlay,
    isPlaying: phase === "playing_hook" || phase === "playing_full",
    // Z-index based: hook is on top during hook phase, full on top after swap
    hookOnTop: phase !== "playing_full" && phase !== "ended",
  };
}
