/**
 * useHls.ts — Reusable HLS adaptive streaming hook
 *
 * PURPOSE:
 *   Encapsulates hls.js setup for adaptive bitrate streaming. Handles:
 *   - Safari: Native HLS support (video.src = manifest URL directly)
 *   - Chrome/Firefox: Dynamic import of hls.js → MSE-based playback
 *   - Fallback: If hls.js fails or MSE unavailable → direct MP4 src
 *
 * API:
 *   const { attachHls, detachHls } = useHls();
 *   // Returns true if HLS is active, false if fell back to MP4
 *   const isHls = await attachHls(videoEl, manifestUrl, mp4Fallback, startTime?);
 *   detachHls(); // cleanup on unmount or source change
 *
 * USED BY:
 *   - SimpleMobilePlayer.tsx (mobile adaptive streaming)
 *   - useSmartSync.ts (desktop full video adaptive streaming)
 */

"use client";

import { useRef, useCallback } from "react";
import type Hls from "hls.js";

interface UseHlsReturn {
  /** Attach HLS to a video element. Returns true if HLS active, false if MP4 fallback. */
  attachHls: (
    video: HTMLVideoElement,
    hlsManifestUrl: string,
    mp4FallbackUrl: string,
    startPosition?: number
  ) => Promise<boolean>;
  /** Detach and destroy the current hls.js instance. Safe to call if not attached. */
  detachHls: () => void;
}

export function useHls(): UseHlsReturn {
  const hlsRef = useRef<Hls | null>(null);

  const detachHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const attachHls = useCallback(
    async (
      video: HTMLVideoElement,
      hlsManifestUrl: string,
      mp4FallbackUrl: string,
      startPosition?: number
    ): Promise<boolean> => {
      // Clean up any existing instance
      detachHls();

      // Safari / iOS: native HLS support — use it directly
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsManifestUrl;
        if (startPosition !== undefined && startPosition > 0) {
          video.currentTime = startPosition;
        }
        return true;
      }

      // Chrome / Firefox: use hls.js via dynamic import
      try {
        const HlsModule = await import("hls.js");
        const HlsClass = HlsModule.default;

        if (!HlsClass.isSupported()) {
          // MSE not available — fall back to MP4
          video.src = mp4FallbackUrl;
          if (startPosition !== undefined && startPosition > 0) {
            video.currentTime = startPosition;
          }
          return false;
        }

        const hls = new HlsClass({
          // Start at the highest quality — the viewer already has bandwidth
          // from the hook clip / micro-segment. Don't make them watch 480p
          // for the first few seconds while ABR ramps up.
          startLevel: -1, // auto-select
          // Don't cap the max level
          capLevelToPlayerSize: false,
          // Start loading immediately
          autoStartLoad: true,
          startPosition: startPosition ?? -1,
          // Offload TS→fMP4 transmuxing to a Web Worker — keeps the main
          // thread free for rendering, player UI, and analytics
          enableWorker: true,
          // Buffer limits — prevent memory bloat on constrained devices.
          // 30s forward buffer is enough for seamless playback while keeping
          // memory usage reasonable (~50-80MB vs unbounded growth).
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Only keep 10s of already-played video in memory
          backBufferLength: 10,
        });

        hlsRef.current = hls;

        hls.loadSource(hlsManifestUrl);
        hls.attachMedia(video);

        // On fatal error, fall back to MP4
        hls.on(HlsClass.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn("[useHls] Fatal HLS error, falling back to MP4:", data.type);
            hls.destroy();
            hlsRef.current = null;
            video.src = mp4FallbackUrl;
            if (startPosition !== undefined && startPosition > 0) {
              video.currentTime = startPosition;
            }
          }
        });

        return true;
      } catch (err) {
        // Dynamic import failed — fall back to MP4
        console.warn("[useHls] Failed to load hls.js, using MP4 fallback:", err);
        video.src = mp4FallbackUrl;
        if (startPosition !== undefined && startPosition > 0) {
          video.currentTime = startPosition;
        }
        return false;
      }
    },
    [detachHls]
  );

  return { attachHls, detachHls };
}
