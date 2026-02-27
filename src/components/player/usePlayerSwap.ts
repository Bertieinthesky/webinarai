/**
 * usePlayerSwap.ts — Smart dual-player state machine hook
 *
 * PURPOSE:
 *   This is the core engine behind webinar.ai's instant-playback embed player.
 *   It manages TWO <video> elements simultaneously to create the illusion of
 *   a single video that starts playing instantly.
 *
 * HOW IT WORKS:
 *   1. On mount: Both video elements get their sources set
 *      - hookRef loads the small hook clip (~2MB, loads fast)
 *      - fullRef loads the full variant video (larger, buffers in background)
 *   2. When hook clip is ready: It starts playing immediately (instant playback!)
 *   3. While hook plays: Full video is buffering silently in the background
 *   4. When hook clip ends: Seamless swap occurs:
 *      - Full video is seeked to hookEndTimeMs (exact timestamp where hook ends)
 *      - Full video starts playing
 *      - Visibility is swapped (hide hook, show full) in a single frame
 *   5. Viewer perceives: One continuous video that started instantly
 *
 * STATE MACHINE:
 *   idle → loading_hook → playing_hook → swapping → playing_full → ended
 *                                                     ↕
 *                                                   paused
 *   Any state → error (on network/decode failure)
 *
 * WHY A STATE MACHINE:
 *   Video playback involves many async events (canplay, ended, seeked, etc.)
 *   and race conditions (what if the hook ends before the full video buffers?).
 *   A state machine makes the transitions explicit and debuggable. Each state
 *   has clear entry/exit conditions, preventing impossible states.
 *
 * ARCHITECTURE:
 *   - Used by: EmbedPlayer.tsx component
 *   - Returns: refs for both video elements, current phase, and control functions
 *   - Callbacks: onPlay, onProgress, onComplete for analytics tracking
 */

"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type PlayerPhase =
  | "idle"
  | "loading_hook"
  | "playing_hook"
  | "swapping"
  | "playing_full"
  | "paused"
  | "ended"
  | "error";

interface UsePlayerSwapOptions {
  hookClipUrl: string;
  fullVideoUrl: string;
  hookEndTimeMs: number;
  onPlay?: () => void;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

export function usePlayerSwap({
  hookClipUrl,
  fullVideoUrl,
  hookEndTimeMs,
  onPlay,
  onProgress,
  onComplete,
}: UsePlayerSwapOptions) {
  const hookRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullVideoReady, setFullVideoReady] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active player is whichever is currently visible
  const activeRef = phase === "playing_full" || phase === "ended" ? fullRef : hookRef;

  // Start loading when URLs are available
  useEffect(() => {
    if (!hookClipUrl || !fullVideoUrl) return;

    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    setPhase("loading_hook");

    // Set sources
    hook.src = hookClipUrl;
    hook.load();

    full.src = fullVideoUrl;
    full.preload = "auto";
    full.load();

    // Monitor full video buffering
    const checkBuffer = () => {
      if (full.readyState >= 3) {
        // HAVE_FUTURE_DATA or better
        setFullVideoReady(true);
      }
    };

    full.addEventListener("canplaythrough", () => setFullVideoReady(true));
    full.addEventListener("progress", checkBuffer);

    return () => {
      full.removeEventListener("canplaythrough", () => setFullVideoReady(true));
      full.removeEventListener("progress", checkBuffer);
    };
  }, [hookClipUrl, fullVideoUrl]);

  // Hook can play → start playing
  useEffect(() => {
    const hook = hookRef.current;
    if (!hook || phase !== "loading_hook") return;

    const handleCanPlay = () => {
      setPhase("playing_hook");
      hook.play().catch(() => {
        // Autoplay blocked — user needs to click
        setPhase("idle");
      });
      onPlay?.();
    };

    hook.addEventListener("canplay", handleCanPlay);
    return () => hook.removeEventListener("canplay", handleCanPlay);
  }, [phase, onPlay]);

  // Hook ended → swap to full video
  useEffect(() => {
    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    const handleHookEnded = async () => {
      setPhase("swapping");

      // Seek full video to where hook ends
      const seekTime = hookEndTimeMs / 1000;
      full.currentTime = seekTime;

      const doSwap = async () => {
        try {
          await full.play();
          // Use requestAnimationFrame to ensure the frame is rendered before swapping
          requestAnimationFrame(() => {
            setPhase("playing_full");
            if (full.duration) {
              setDuration(full.duration);
            }
          });
        } catch {
          setPhase("error");
        }
      };

      if (full.readyState >= 3) {
        // Full video ready — swap immediately
        await doSwap();
      } else {
        // Wait for full video to be ready
        full.addEventListener("canplay", doSwap, { once: true });
      }
    };

    hook.addEventListener("ended", handleHookEnded);
    return () => hook.removeEventListener("ended", handleHookEnded);
  }, [hookEndTimeMs]);

  // Track current time and progress
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

      let time: number;
      if (phase === "playing_hook") {
        time = active.currentTime;
      } else {
        time = active.currentTime;
      }
      setCurrentTime(time);

      const dur = phase === "playing_full" ? (fullRef.current?.duration || 0) : 0;
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

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;

    if (phase === "idle") {
      // First click — start hook
      const hook = hookRef.current;
      if (hook) {
        hook.play().then(() => setPhase("playing_hook"));
        onPlay?.();
      }
      return;
    }

    if (active.paused) {
      active.play().then(() => {
        setPhase(
          activeRef === fullRef ? "playing_full" : "playing_hook"
        );
      });
    } else {
      active.pause();
      setPhase("paused");
    }
  }, [phase, activeRef, onPlay]);

  return {
    hookRef,
    fullRef,
    phase,
    currentTime,
    duration,
    fullVideoReady,
    togglePlay,
    isPlaying: phase === "playing_hook" || phase === "playing_full",
    showHook: phase !== "playing_full" && phase !== "ended",
    showFull: phase === "playing_full" || phase === "ended",
  };
}
