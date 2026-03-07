/**
 * SegmentComparison — Compares segments of the same type side-by-side
 *
 * Shows which hook/body/CTA is winning based on completion rate
 * of variants that use each segment.
 */

"use client";

import { useAnalytics } from "@/hooks/use-analytics";

interface SegmentComparisonProps {
  projectId: string;
  segmentType: "hook" | "body" | "cta";
  startDate: string | null;
  endDate: string | null;
}

const typeLabels = {
  hook: "Hooks",
  body: "Bodies",
  cta: "CTAs",
};

const typeColors = {
  hook: { bar: "bg-sky-400/60", text: "text-sky-400" },
  body: { bar: "bg-emerald-400/60", text: "text-emerald-400" },
  cta: { bar: "bg-violet-400/60", text: "text-violet-400" },
};

export function SegmentComparison({
  projectId,
  segmentType,
  startDate,
  endDate,
}: SegmentComparisonProps) {
  const { data: analytics } = useAnalytics({
    projectId,
    segmentType,
    startDate,
    endDate,
  });

  const segments = analytics?.segmentAnalytics;
  if (!segments || segments.length < 2) return null;

  const maxRate = Math.max(...segments.map((s) => s.completion_rate || 0), 1);
  const bestId = segments.reduce((best, s) =>
    (s.completion_rate || 0) > (best.completion_rate || 0) ? s : best
  ).segment_id;

  const colors = typeColors[segmentType];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h4 className={`text-xs font-medium uppercase tracking-wider ${colors.text} mb-3`}>
        {typeLabels[segmentType]} Comparison
      </h4>

      <div className="space-y-3">
        {segments.map((seg) => {
          const isBest = seg.segment_id === bestId && seg.completion_rate > 0;

          return (
            <div key={seg.segment_id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">
                    {seg.segment_label}
                  </span>
                  {isBest && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      Winner
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums text-white/50">
                  {seg.completion_rate}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{
                    width: `${((seg.completion_rate || 0) / maxRate) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[11px] text-white/25">
                <span>{seg.total_views} views</span>
                <span>{seg.unique_viewers} unique</span>
                <span>{seg.complete_count} completions</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
