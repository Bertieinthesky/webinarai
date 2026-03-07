/**
 * WaveformTimeline.tsx — Canvas-based waveform + thumbnails + draggable markers + suggestions
 *
 * The core visual piece of the splitter. Renders:
 * - Thumbnail filmstrip (top 45px)
 * - Waveform bars colored by segment region
 * - Suggested markers (ghosted, from scene detection — accept/dismiss)
 * - User markers (solid amber, draggable)
 * - Playhead (red vertical line tracking video currentTime)
 * - Click-to-seek, double-click-to-add, drag-to-move
 */

"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Thumbnail } from "@/hooks/use-thumbnails";

export interface Marker {
  id: string;
  timeMs: number;
  label: string;
}

export interface SuggestedMarker {
  timeMs: number;
  confidence: number;
  type: "scene_change" | "silence";
}

const SEGMENT_COLORS = [
  "rgba(56, 189, 248, 0.5)",  // sky
  "rgba(52, 211, 153, 0.5)",  // emerald
  "rgba(167, 139, 250, 0.5)", // violet
  "rgba(251, 191, 36, 0.5)",  // amber
  "rgba(251, 113, 133, 0.5)", // rose
  "rgba(96, 165, 250, 0.5)",  // blue
];

const SEGMENT_BAR_COLORS = [
  "rgba(56, 189, 248, 0.8)",
  "rgba(52, 211, 153, 0.8)",
  "rgba(167, 139, 250, 0.8)",
  "rgba(251, 191, 36, 0.8)",
  "rgba(251, 113, 133, 0.8)",
  "rgba(96, 165, 250, 0.8)",
];

const MARKER_COLOR = "#f59e0b";  // amber-400
const SUGGESTION_COLOR = "rgba(245, 158, 11, 0.25)"; // faded amber
const SUGGESTION_HOVER_COLOR = "rgba(245, 158, 11, 0.7)";
const PLAYHEAD_COLOR = "#ef4444"; // red-500
const HANDLE_SIZE = 10;
const MARKER_HIT_WIDTH = 12;

// Layout
const THUMB_STRIP_HEIGHT = 45;
const THUMB_GAP = 5;
const WAVEFORM_HEIGHT = 120;
const TOTAL_HEIGHT = THUMB_STRIP_HEIGHT + THUMB_GAP + WAVEFORM_HEIGHT; // 170

interface WaveformTimelineProps {
  peaks: number[];
  durationMs: number;
  currentTimeMs: number;
  markers: Marker[];
  playing: boolean;
  thumbnails?: Thumbnail[];
  suggestedMarkers?: SuggestedMarker[];
  onSeek: (timeMs: number) => void;
  onMarkerAdd: (timeMs: number) => void;
  onMarkerMove: (id: string, timeMs: number) => void;
  onMarkerRemove: (id: string) => void;
  onSuggestionAccept?: (timeMs: number) => void;
  onSuggestionDismiss?: (timeMs: number) => void;
}

export function WaveformTimeline({
  peaks,
  durationMs,
  currentTimeMs,
  markers,
  playing,
  thumbnails,
  suggestedMarkers,
  onSeek,
  onMarkerAdd,
  onMarkerMove,
  onMarkerRemove,
  onSuggestionAccept,
  onSuggestionDismiss,
}: WaveformTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const draggingRef = useRef<{ id: string; offsetX: number } | null>(null);
  const thumbImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<number | null>(null); // timeMs
  const [canvasWidth, setCanvasWidth] = useState(0);

  const hasThumbnails = thumbnails && thumbnails.length > 0;
  const canvasHeight = hasThumbnails ? TOTAL_HEIGHT : WAVEFORM_HEIGHT;
  const waveformTop = hasThumbnails ? THUMB_STRIP_HEIGHT + THUMB_GAP : 0;

  // Pre-load thumbnail images
  useEffect(() => {
    if (!thumbnails) return;
    const map = new Map<number, HTMLImageElement>();
    for (const thumb of thumbnails) {
      const img = new Image();
      img.src = thumb.dataUrl;
      map.set(thumb.timeMs, img);
    }
    thumbImagesRef.current = map;
  }, [thumbnails]);

  // Observe container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Convert time to X position
  const timeToX = useCallback(
    (timeMs: number) => {
      if (durationMs <= 0) return 0;
      return (timeMs / durationMs) * canvasWidth;
    },
    [durationMs, canvasWidth]
  );

  // Convert X position to time
  const xToTime = useCallback(
    (x: number) => {
      if (canvasWidth <= 0) return 0;
      return Math.max(0, Math.min(durationMs, (x / canvasWidth) * durationMs));
    },
    [durationMs, canvasWidth]
  );

  // Sort markers for segment coloring
  const sortedMarkers = [...markers].sort((a, b) => a.timeMs - b.timeMs);

  // Get segment index for a given time
  const getSegmentIndex = useCallback(
    (timeMs: number) => {
      let idx = 0;
      for (const m of sortedMarkers) {
        if (timeMs >= m.timeMs) idx++;
        else break;
      }
      return idx;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedMarkers.map((m) => m.timeMs).join(",")]
  );

  // Draw canvas
  const draw = useCallback(
    (playheadTimeMs?: number) => {
      const canvas = canvasRef.current;
      if (!canvas || canvasWidth === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvasWidth;
      const h = canvasHeight;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      // Clear
      ctx.clearRect(0, 0, w, h);

      // ── Thumbnail strip ──
      if (hasThumbnails && thumbnails) {
        // Dark background for thumbnail strip
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, w, THUMB_STRIP_HEIGHT);

        const thumbWidth = w / thumbnails.length;
        for (let i = 0; i < thumbnails.length; i++) {
          const thumb = thumbnails[i];
          const img = thumbImagesRef.current.get(thumb.timeMs);
          const tx = i * thumbWidth;

          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, tx, 0, thumbWidth, THUMB_STRIP_HEIGHT);
          }

          // Subtle divider between thumbnails
          if (i > 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
            ctx.fillRect(tx, 0, 1, THUMB_STRIP_HEIGHT);
          }
        }

        // Bottom border of thumbnail strip
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(0, THUMB_STRIP_HEIGHT, w, 1);
      }

      // ── Waveform area (offset by waveformTop) ──
      const wH = WAVEFORM_HEIGHT;

      // Draw segment backgrounds
      const boundaries = [0, ...sortedMarkers.map((m) => m.timeMs), durationMs];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const x1 = timeToX(boundaries[i]);
        const x2 = timeToX(boundaries[i + 1]);
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        ctx.fillRect(x1, waveformTop, x2 - x1, wH);
      }

      // Draw waveform bars
      if (peaks.length > 0) {
        const barWidth = Math.max(1, w / peaks.length - 0.5);
        const gap = w / peaks.length;
        const halfH = wH / 2;

        for (let i = 0; i < peaks.length; i++) {
          const x = i * gap;
          const barH = peaks[i] * halfH * 0.9;
          const barTimeMs = (i / peaks.length) * durationMs;
          const segIdx = getSegmentIndex(barTimeMs);

          ctx.fillStyle = SEGMENT_BAR_COLORS[segIdx % SEGMENT_BAR_COLORS.length];
          ctx.fillRect(x, waveformTop + halfH - barH, barWidth, barH * 2);
        }
      }

      // ── Suggested markers (behind user markers) ──
      if (suggestedMarkers) {
        for (const suggestion of suggestedMarkers) {
          const x = timeToX(suggestion.timeMs);
          const isHovered = hoveredSuggestion === suggestion.timeMs;

          // Suggestion line — spans full height
          ctx.strokeStyle = isHovered ? SUGGESTION_HOVER_COLOR : SUGGESTION_COLOR;
          ctx.lineWidth = isHovered ? 2 : 1.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
          ctx.setLineDash([]);

          // Hollow diamond handle at waveform top
          const handleY = waveformTop + 2;
          ctx.strokeStyle = isHovered ? SUGGESTION_HOVER_COLOR : SUGGESTION_COLOR;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, handleY);
          ctx.lineTo(x + HANDLE_SIZE / 2, handleY + HANDLE_SIZE / 2);
          ctx.lineTo(x, handleY + HANDLE_SIZE);
          ctx.lineTo(x - HANDLE_SIZE / 2, handleY + HANDLE_SIZE / 2);
          ctx.closePath();
          ctx.stroke();

          // Type indicator dot — green for scene change, blue for silence
          if (isHovered) {
            const dotColor = suggestion.type === "scene_change"
              ? "rgba(52, 211, 153, 0.9)"
              : "rgba(96, 165, 250, 0.9)";
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(x, handleY + HANDLE_SIZE + 6, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Accept/dismiss buttons on hover
          if (isHovered) {
            // Accept button (green checkmark circle) — left of marker
            const acceptX = x - 14;
            const btnY = waveformTop + 4;
            ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
            ctx.beginPath();
            ctx.arc(acceptX, btnY + 6, 7, 0, Math.PI * 2);
            ctx.fill();
            // Checkmark
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(acceptX - 3, btnY + 6);
            ctx.lineTo(acceptX - 0.5, btnY + 8.5);
            ctx.lineTo(acceptX + 3.5, btnY + 3.5);
            ctx.stroke();

            // Dismiss button (red X circle) — right of marker
            const dismissX = x + 14;
            ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
            ctx.beginPath();
            ctx.arc(dismissX, btnY + 6, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(dismissX - 3, btnY + 3);
            ctx.lineTo(dismissX + 3, btnY + 9);
            ctx.moveTo(dismissX + 3, btnY + 3);
            ctx.lineTo(dismissX - 3, btnY + 9);
            ctx.stroke();
          }
        }
      }

      // ── User markers (on top of suggestions) ──
      for (const marker of sortedMarkers) {
        const x = timeToX(marker.timeMs);
        const isHovered = hoveredMarker === marker.id;

        // Marker line — spans full height
        ctx.strokeStyle = MARKER_COLOR;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Handle (filled diamond at waveform top)
        const handleY = waveformTop + 2;
        ctx.fillStyle = MARKER_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, handleY);
        ctx.lineTo(x + HANDLE_SIZE / 2, handleY + HANDLE_SIZE / 2);
        ctx.lineTo(x, handleY + HANDLE_SIZE);
        ctx.lineTo(x - HANDLE_SIZE / 2, handleY + HANDLE_SIZE / 2);
        ctx.closePath();
        ctx.fill();

        // X button on hover
        if (isHovered) {
          const btnX = x + 8;
          const btnY = waveformTop + 4;
          ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
          ctx.beginPath();
          ctx.arc(btnX, btnY + 6, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(btnX - 3, btnY + 3);
          ctx.lineTo(btnX + 3, btnY + 9);
          ctx.moveTo(btnX + 3, btnY + 3);
          ctx.lineTo(btnX - 3, btnY + 9);
          ctx.stroke();
        }
      }

      // ── Playhead ──
      const playheadX = timeToX(playheadTimeMs ?? currentTimeMs);
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();

      // Playhead triangle at top
      ctx.fillStyle = PLAYHEAD_COLOR;
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 6);
      ctx.fill();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasWidth, canvasHeight, peaks, durationMs, currentTimeMs, sortedMarkers, hoveredMarker, hoveredSuggestion, timeToX, getSegmentIndex, hasThumbnails, thumbnails, suggestedMarkers, waveformTop]
  );

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Animation loop for smooth playhead when playing
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    let lastDraw = 0;
    const tick = (time: number) => {
      if (time - lastDraw > 16) {
        // ~60fps
        draw();
        lastDraw = time;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [playing, draw]);

  // Mouse handlers
  const getCanvasXY = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const findMarkerAtX = useCallback(
    (x: number) => {
      for (const marker of sortedMarkers) {
        const markerX = timeToX(marker.timeMs);
        if (Math.abs(x - markerX) < MARKER_HIT_WIDTH) {
          return marker;
        }
      }
      return null;
    },
    [sortedMarkers, timeToX]
  );

  const findSuggestionAtX = useCallback(
    (x: number) => {
      if (!suggestedMarkers) return null;
      for (const suggestion of suggestedMarkers) {
        const sx = timeToX(suggestion.timeMs);
        if (Math.abs(x - sx) < MARKER_HIT_WIDTH) {
          return suggestion;
        }
      }
      return null;
    },
    [suggestedMarkers, timeToX]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasXY(e);

      // Check user markers first
      const marker = findMarkerAtX(x);
      if (marker) {
        const markerX = timeToX(marker.timeMs);
        const btnX = markerX + 8;
        const btnY = waveformTop + 10;
        if (Math.abs(x - btnX) < 8 && y > waveformTop && y < btnY + 8) {
          onMarkerRemove(marker.id);
          return;
        }
        draggingRef.current = { id: marker.id, offsetX: x - markerX };
        return;
      }

      // Check suggestions
      const suggestion = findSuggestionAtX(x);
      if (suggestion && hoveredSuggestion === suggestion.timeMs) {
        const sx = timeToX(suggestion.timeMs);
        const acceptX = sx - 14;
        const dismissX = sx + 14;
        const btnY = waveformTop + 10;

        // Accept button hit
        if (Math.abs(x - acceptX) < 8 && y > waveformTop && y < btnY + 8) {
          onSuggestionAccept?.(suggestion.timeMs);
          return;
        }
        // Dismiss button hit
        if (Math.abs(x - dismissX) < 8 && y > waveformTop && y < btnY + 8) {
          onSuggestionDismiss?.(suggestion.timeMs);
          return;
        }
      }

      // Click to seek
      onSeek(xToTime(x));
    },
    [getCanvasXY, findMarkerAtX, findSuggestionAtX, timeToX, xToTime, waveformTop, onSeek, onMarkerRemove, onSuggestionAccept, onSuggestionDismiss, hoveredSuggestion]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x } = getCanvasXY(e);

      if (draggingRef.current) {
        const newX = x - draggingRef.current.offsetX;
        onMarkerMove(draggingRef.current.id, xToTime(newX));
        return;
      }

      // Hover detection — user markers take priority
      const marker = findMarkerAtX(x);
      setHoveredMarker(marker?.id ?? null);

      // If not hovering a user marker, check suggestions
      if (!marker) {
        const suggestion = findSuggestionAtX(x);
        setHoveredSuggestion(suggestion?.timeMs ?? null);
      } else {
        setHoveredSuggestion(null);
      }

      // Cursor style
      const canvas = canvasRef.current;
      if (canvas) {
        if (marker) canvas.style.cursor = "col-resize";
        else if (findSuggestionAtX(x)) canvas.style.cursor = "pointer";
        else canvas.style.cursor = "crosshair";
      }
    },
    [getCanvasXY, findMarkerAtX, findSuggestionAtX, xToTime, onMarkerMove]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x } = getCanvasXY(e);
      const marker = findMarkerAtX(x);
      if (!marker) {
        onMarkerAdd(xToTime(x));
      }
    },
    [getCanvasXY, findMarkerAtX, xToTime, onMarkerAdd]
  );

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight }}
        className="rounded-md"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredSuggestion(null);
        }}
        onDoubleClick={handleDoubleClick}
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-white/40">
        <span>0:00</span>
        <span className="text-white/30">Double-click to add marker</span>
        <span>{durationMs > 0 ? formatMs(durationMs) : "--:--"}</span>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
