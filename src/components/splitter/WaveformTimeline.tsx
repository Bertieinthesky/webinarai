/**
 * WaveformTimeline.tsx — Canvas-based waveform + draggable split markers + playhead
 *
 * The core visual piece of the splitter. Renders:
 * - Waveform bars colored by segment region
 * - Playhead (red vertical line tracking video currentTime)
 * - Split markers (draggable vertical lines with handles)
 * - Click-to-seek on the timeline
 */

"use client";

import { useRef, useEffect, useCallback, useState } from "react";

export interface Marker {
  id: string;
  timeMs: number;
  label: string;
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
const PLAYHEAD_COLOR = "#ef4444"; // red-500
const HANDLE_SIZE = 10;
const MARKER_HIT_WIDTH = 12;

interface WaveformTimelineProps {
  peaks: number[];
  durationMs: number;
  currentTimeMs: number;
  markers: Marker[];
  playing: boolean;
  onSeek: (timeMs: number) => void;
  onMarkerAdd: (timeMs: number) => void;
  onMarkerMove: (id: string, timeMs: number) => void;
  onMarkerRemove: (id: string) => void;
}

export function WaveformTimeline({
  peaks,
  durationMs,
  currentTimeMs,
  markers,
  playing,
  onSeek,
  onMarkerAdd,
  onMarkerMove,
  onMarkerRemove,
}: WaveformTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const draggingRef = useRef<{ id: string; offsetX: number } | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight] = useState(120);

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

      // Draw segment backgrounds
      const boundaries = [0, ...sortedMarkers.map((m) => m.timeMs), durationMs];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const x1 = timeToX(boundaries[i]);
        const x2 = timeToX(boundaries[i + 1]);
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        ctx.fillRect(x1, 0, x2 - x1, h);
      }

      // Draw waveform bars
      if (peaks.length > 0) {
        const barWidth = Math.max(1, w / peaks.length - 0.5);
        const gap = w / peaks.length;
        const halfH = h / 2;

        for (let i = 0; i < peaks.length; i++) {
          const x = i * gap;
          const barH = peaks[i] * halfH * 0.9;
          const barTimeMs = (i / peaks.length) * durationMs;
          const segIdx = getSegmentIndex(barTimeMs);

          ctx.fillStyle = SEGMENT_BAR_COLORS[segIdx % SEGMENT_BAR_COLORS.length];
          ctx.fillRect(x, halfH - barH, barWidth, barH * 2);
        }
      }

      // Draw markers
      for (const marker of sortedMarkers) {
        const x = timeToX(marker.timeMs);
        const isHovered = hoveredMarker === marker.id;

        // Marker line
        ctx.strokeStyle = MARKER_COLOR;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Handle (diamond shape at top)
        ctx.fillStyle = MARKER_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x + HANDLE_SIZE / 2, 2 + HANDLE_SIZE / 2);
        ctx.moveTo(x, 2);
        ctx.lineTo(x - HANDLE_SIZE / 2, 2 + HANDLE_SIZE / 2);
        ctx.lineTo(x, 2 + HANDLE_SIZE);
        ctx.lineTo(x + HANDLE_SIZE / 2, 2 + HANDLE_SIZE / 2);
        ctx.fill();

        // X button on hover
        if (isHovered) {
          const btnX = x + 8;
          const btnY = 4;
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

      // Draw playhead
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
    [canvasWidth, canvasHeight, peaks, durationMs, currentTimeMs, sortedMarkers, hoveredMarker, timeToX, getSegmentIndex]
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
  const getCanvasX = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientX - rect.left;
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const x = getCanvasX(e);
      const marker = findMarkerAtX(x);

      if (marker) {
        // Check if clicking the X button
        const markerX = timeToX(marker.timeMs);
        const btnX = markerX + 8;
        const btnY = 10;
        if (Math.abs(x - btnX) < 8 && e.nativeEvent.offsetY < btnY + 8) {
          onMarkerRemove(marker.id);
          return;
        }

        // Start dragging
        draggingRef.current = { id: marker.id, offsetX: x - markerX };
        return;
      }

      // Click to seek
      onSeek(xToTime(x));
    },
    [getCanvasX, findMarkerAtX, timeToX, xToTime, onSeek, onMarkerRemove]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const x = getCanvasX(e);

      if (draggingRef.current) {
        const newX = x - draggingRef.current.offsetX;
        onMarkerMove(draggingRef.current.id, xToTime(newX));
        return;
      }

      // Hover detection
      const marker = findMarkerAtX(x);
      setHoveredMarker(marker?.id ?? null);

      // Cursor style
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = marker ? "col-resize" : "crosshair";
      }
    },
    [getCanvasX, findMarkerAtX, xToTime, onMarkerMove]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const x = getCanvasX(e);
      const marker = findMarkerAtX(x);
      if (!marker) {
        onMarkerAdd(xToTime(x));
      }
    },
    [getCanvasX, findMarkerAtX, xToTime, onMarkerAdd]
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
        onMouseLeave={handleMouseUp}
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
