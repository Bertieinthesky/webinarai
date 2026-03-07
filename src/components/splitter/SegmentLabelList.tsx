/**
 * SegmentLabelList.tsx — Segment labeling UI below the timeline
 *
 * Shows each segment (regions between markers) with time range,
 * duration, color indicator, and editable label.
 */

"use client";

import type { Marker } from "./WaveformTimeline";
import { formatDuration } from "@/lib/utils/format";

const SEGMENT_COLORS = [
  "bg-sky-400",
  "bg-emerald-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-blue-400",
];

const LABEL_PRESETS = ["Hook", "Body", "CTA", "Intro", "Outro"];

interface SegmentLabelListProps {
  markers: Marker[];
  durationMs: number;
  onMarkerLabelChange: (id: string, label: string) => void;
}

interface SegmentInfo {
  index: number;
  startMs: number;
  endMs: number;
  label: string;
  /** The marker that starts this segment (null for the first segment). */
  markerId: string | null;
}

export function SegmentLabelList({
  markers,
  durationMs,
  onMarkerLabelChange,
}: SegmentLabelListProps) {
  const sortedMarkers = [...markers].sort((a, b) => a.timeMs - b.timeMs);

  // Build segments from markers
  const segments: SegmentInfo[] = [];
  const boundaries = [0, ...sortedMarkers.map((m) => m.timeMs), durationMs];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMs = boundaries[i];
    const endMs = boundaries[i + 1];
    if (endMs <= startMs) continue;

    // First segment uses first marker's label, subsequent use the marker before them
    const markerIdx = i === 0 ? 0 : i - 1;
    const marker = sortedMarkers[markerIdx];

    segments.push({
      index: i,
      startMs,
      endMs,
      label: marker?.label || `Segment ${i + 1}`,
      markerId: marker?.id ?? null,
    });
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">
        Double-click on the timeline to add split markers
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-white/50 uppercase tracking-wider">
        Segments ({segments.length})
      </div>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div
            key={seg.index}
            className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 transition hover:bg-white/[0.05]"
          >
            {/* Color indicator */}
            <div
              className={`h-3 w-3 rounded-sm ${SEGMENT_COLORS[seg.index % SEGMENT_COLORS.length]}`}
            />

            {/* Time range */}
            <span className="font-mono text-xs text-white/50 tabular-nums">
              {formatMs(seg.startMs)} — {formatMs(seg.endMs)}
            </span>

            {/* Duration */}
            <span className="text-xs text-white/30">
              ({formatDuration(seg.endMs - seg.startMs)})
            </span>

            {/* Label */}
            <div className="ml-auto flex items-center gap-1.5">
              {LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    if (seg.markerId) {
                      onMarkerLabelChange(seg.markerId, preset);
                    } else if (sortedMarkers[0]) {
                      onMarkerLabelChange(sortedMarkers[0].id, preset);
                    }
                  }}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                    seg.label === preset
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:bg-white/5 hover:text-white/60"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
