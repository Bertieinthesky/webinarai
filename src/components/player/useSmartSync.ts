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
  onPlay?: () => void;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

// Check for requestVideoFrameCallback support
function supportsRVFC(el: HTMLVideoElement): boolean {
  return "requestVideoFrameCallback" in el;
}

export function useSmartSync({
  hookClipUrl,
  fullVideoUrl,
  onPlay,
  onProgress,
  onComplete,
}: UseSmartSyncOptions) {
  const hookRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);
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
  useEffect(() => {
    if (!hookClipUrl || !fullVideoUrl) return;

    const hook = hookRef.current;
    const full = fullRef.current;
    if (!hook || !full) return;

    swappedRef.current = false;
    syncActiveRef.current = false;

    // Set sources — both start at 0:00
    hook.src = hookClipUrl;
    hook.preload = "auto";
    hook.load();

    full.src = fullVideoUrl;
    full.preload = "auto";
    full.muted = true;
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

      // Unmute full video, mute + pause hook
      full.muted = false;
      hook.muted = true;
      hook.pause();

      setPhase("playing_full");
      if (full.duration) {
        setDuration(full.duration);
      }
    };

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

      const correctDrift = () => {
        if (!syncActiveRef.current) return;

        const hookTime = hookMediaTimeRef.current;
        const fullTime = fullMediaTimeRef.current;

        // Only correct once both have reported at least one frame
        if (hookTime === 0 && fullTime === 0) return;

        const drift = hookTime - fullTime; // positive = full is behind

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

      // Play both — hook audio is what the viewer hears
      const hookPlay = hook.play();
      const fullPlay = full.play();

      Promise.all([hookPlay, fullPlay])
        .then(() => {
          setPhase("playing_hook");
          onPlay?.();
        })
        .catch(() => {
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
    hookOnTop: phase !== "playing_full" && phase !== "ended",
  };
}
