/**
 * use-thumbnails.ts — Extract thumbnail strip from a video blob
 *
 * Uses a hidden <video> + <canvas> to seek through the video at
 * regular intervals and capture frames as small JPEG data URLs.
 * Returns an array of thumbnails for rendering as a filmstrip.
 *
 * The video is already loaded as an Object URL in the browser,
 * so this requires no server roundtrip.
 *
 * Thumbnails are extracted progressively — they appear one at a time
 * as each frame is captured, so the UI can render partial results.
 */

"use client";

import { useState, useEffect, useRef } from "react";

export interface Thumbnail {
  timeMs: number;
  dataUrl: string;
}

export interface UseThumbnailsResult {
  thumbnails: Thumbnail[];
  loading: boolean;
  progress: number; // 0-100
}

const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;
const TARGET_COUNT = 60;

export function useThumbnails(
  videoUrl: string | null,
  durationMs: number
): UseThumbnailsResult {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!videoUrl || durationMs <= 0) {
      setThumbnails([]);
      setLoading(false);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setProgress(0);
    setThumbnails([]);

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    video.src = videoUrl;
    video.muted = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const intervalMs = durationMs / TARGET_COUNT;
    let currentIndex = 0;

    function seekNext() {
      if (abortRef.current || currentIndex >= TARGET_COUNT) {
        setLoading(false);
        setProgress(100);
        video.removeAttribute("src");
        video.load(); // release resources
        return;
      }

      const timeMs = currentIndex * intervalMs;
      video.currentTime = timeMs / 1000;
    }

    function onSeeked() {
      if (abortRef.current) return;

      ctx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

      const thumb: Thumbnail = {
        timeMs: video.currentTime * 1000,
        dataUrl,
      };

      // Progressive update — add one thumbnail at a time
      setThumbnails((prev) => [...prev, thumb]);

      currentIndex++;
      setProgress(Math.round((currentIndex / TARGET_COUNT) * 100));
      seekNext();
    }

    function onLoaded() {
      seekNext();
    }

    function onError() {
      setLoading(false);
      setThumbnails([]);
    }

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    return () => {
      abortRef.current = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
  }, [videoUrl, durationMs]);

  return { thumbnails, loading, progress };
}
