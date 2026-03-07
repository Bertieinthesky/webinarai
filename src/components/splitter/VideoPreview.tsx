/**
 * VideoPreview.tsx — Video player synced with the waveform timeline
 *
 * Simple <video> element with play/pause, current time display,
 * and bidirectional sync with the timeline playhead.
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/utils/format";

interface VideoPreviewProps {
  src: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  onTimeUpdate: (timeMs: number) => void;
  onDurationChange: (durationMs: number) => void;
  onPlayPause: (playing: boolean) => void;
  onLoadedMetadata?: (meta: { width: number; height: number; duration: number }) => void;
}

export function VideoPreview({
  src,
  currentTime,
  duration,
  playing,
  onTimeUpdate,
  onDurationChange,
  onPlayPause,
  onLoadedMetadata,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekingFromExternal = useRef(false);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing && video.paused) {
      video.play().catch(() => {});
    } else if (!playing && !video.paused) {
      video.pause();
    }
  }, [playing]);

  // Seek when currentTime changes externally (e.g., from timeline click)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoTimeMs = video.currentTime * 1000;
    if (Math.abs(videoTimeMs - currentTime) > 100) {
      seekingFromExternal.current = true;
      video.currentTime = currentTime / 1000;
    }
  }, [currentTime]);

  const handleTimeUpdate = useCallback(() => {
    if (seekingFromExternal.current) {
      seekingFromExternal.current = false;
      return;
    }
    const video = videoRef.current;
    if (video) {
      onTimeUpdate(video.currentTime * 1000);
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    onDurationChange(video.duration * 1000);
    onLoadedMetadata?.({
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration * 1000,
    });
  }, [onDurationChange, onLoadedMetadata]);

  return (
    <div className="flex flex-col gap-3">
      {/* Video */}
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={src}
          className="w-full"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => onPlayPause(true)}
          onPause={() => onPlayPause(false)}
          onEnded={() => onPlayPause(false)}
        />
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onPlayPause(!playing)}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          {playing ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <span className="font-mono text-xs text-white/60">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
