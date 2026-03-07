/**
 * SegmentTypeSection — Collapsible section showing all segments of one type
 *
 * Shows segment count, expand/collapse toggle, and segment detail rows
 * with preview, duration, size, and status.
 */

"use client";

import { useState, useCallback } from "react";
import { SegmentPreviewDialog } from "./SegmentPreviewDialog";
import { formatDuration, formatFileSize } from "@/lib/utils/format";
import type { Database } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];

const typeConfig = {
  hook: {
    label: "Hooks",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    iconBg: "bg-sky-500/15",
    borderAccent: "border-sky-500/20",
  },
  body: {
    label: "Bodies",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/15",
    borderAccent: "border-emerald-500/20",
  },
  cta: {
    label: "CTAs",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    iconBg: "bg-violet-500/15",
    borderAccent: "border-violet-500/20",
  },
} as const;

const statusStyles: Record<string, { dot: string; text: string }> = {
  normalized: { dot: "bg-emerald-400", text: "text-emerald-400" },
  normalizing: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400" },
  uploaded: { dot: "bg-zinc-400", text: "text-zinc-400" },
  uploading: { dot: "bg-zinc-400 animate-pulse", text: "text-zinc-400" },
  failed: { dot: "bg-red-400", text: "text-red-400" },
};

interface SegmentTypeSectionProps {
  type: "hook" | "body" | "cta";
  segments: Segment[];
  bestSegmentId?: string | null;
}

export function SegmentTypeSection({
  type,
  segments,
  bestSegmentId,
}: SegmentTypeSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [previewSegment, setPreviewSegment] = useState<Segment | null>(null);

  const config = typeConfig[type];

  const handlePreview = useCallback((segment: Segment) => {
    setPreviewSegment(segment);
  }, []);

  return (
    <>
      <div className={`rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-200`}>
        {/* Header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}>
            <span className={`text-base font-semibold tabular-nums ${config.color}`}>
              {segments.length}
            </span>
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-white/80">{config.label}</span>
            <span className="ml-2 text-xs text-white/30">
              {segments.length === 1 ? "1 segment" : `${segments.length} segments`}
            </span>
          </div>
          <svg
            className={`h-4 w-4 text-white/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Expanded content */}
        {expanded && segments.length > 0 && (
          <div className="border-t border-white/5 px-5 pb-4 pt-2">
            <div className="space-y-1.5">
              {segments.map((segment) => {
                const ss = statusStyles[segment.status] || statusStyles.uploaded;
                const isBest = bestSegmentId === segment.id;

                return (
                  <div
                    key={segment.id}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    {/* Play button */}
                    <button
                      onClick={() => handlePreview(segment)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
                      title="Preview"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="6,3 20,12 6,21" />
                      </svg>
                    </button>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70 truncate">
                          {segment.label}
                        </span>
                        {isBest && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Best
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Duration */}
                    <span className="text-xs tabular-nums text-white/30 font-mono">
                      {segment.normalized_duration_ms
                        ? formatDuration(segment.normalized_duration_ms)
                        : segment.original_duration_ms
                          ? formatDuration(segment.original_duration_ms)
                          : "--:--"}
                    </span>

                    {/* Size */}
                    <span className="text-xs tabular-nums text-white/20 font-mono w-16 text-right">
                      {segment.normalized_size_bytes
                        ? formatFileSize(segment.normalized_size_bytes)
                        : segment.original_size_bytes
                          ? formatFileSize(segment.original_size_bytes)
                          : "--"}
                    </span>

                    {/* Status dot */}
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                      <span className={`text-[11px] ${ss.text}`}>
                        {segment.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {expanded && segments.length === 0 && (
          <div className="border-t border-white/5 px-5 py-6 text-center">
            <span className="text-xs text-white/30">
              No {config.label.toLowerCase()} uploaded yet
            </span>
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {previewSegment && (
        <SegmentPreviewDialog
          open={!!previewSegment}
          onOpenChange={(open) => !open && setPreviewSegment(null)}
          label={previewSegment.label}
          storageKey={
            previewSegment.normalized_storage_key ||
            previewSegment.original_storage_key
          }
        />
      )}
    </>
  );
}
