/**
 * VariantDetailPanel — Expanded detail view for a single variant
 *
 * Shows video preview, detailed analytics breakdown, segment labels,
 * and per-day mini chart. Slides in when a variant card is clicked.
 */

"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import type { VariantAnalytics } from "@/hooks/use-analytics";
import type { Database } from "@/lib/supabase/types";

type Variant = Database["public"]["Tables"]["variants"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];

interface VariantDetailPanelProps {
  variant: Variant;
  segments: Segment[];
  projectId: string;
  onClose: () => void;
}

export function VariantDetailPanel({
  variant,
  segments,
  projectId,
  onClose,
}: VariantDetailPanelProps) {
  const { data: analytics } = useAnalytics({ projectId });

  const variantAnalytics: VariantAnalytics | undefined = useMemo(
    () => analytics?.variants?.find((v) => v.variant_id === variant.id),
    [analytics, variant.id]
  );

  // Find segments used in this variant
  const hookSegment = segments.find((s) => s.id === variant.hook_segment_id);
  const bodySegment = segments.find((s) => s.id === variant.body_segment_id);
  const ctaSegment = segments.find((s) => s.id === variant.cta_segment_id);

  const displayName = variant.custom_name || variant.variant_code;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0a0a0c] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a0a0c]/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="text-sm font-medium text-white/80">
              {displayName}
            </h3>
            {variant.custom_name && (
              <p className="mt-0.5 font-mono text-[11px] text-white/25">
                {variant.variant_code}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Segment Breakdown */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-3">
              Segments
            </h4>
            <div className="space-y-2">
              {[
                { label: "Hook", segment: hookSegment, color: "bg-sky-400" },
                { label: "Body", segment: bodySegment, color: "bg-emerald-400" },
                { label: "CTA", segment: ctaSegment, color: "bg-violet-400" },
              ].map(({ label, segment, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-white/50">
                      {label}
                    </span>
                    <p className="truncate text-sm text-white/70">
                      {segment?.label || "—"}
                    </p>
                  </div>
                  {(segment?.normalized_duration_ms ?? segment?.original_duration_ms) ? (
                    <span className="font-mono text-[11px] text-white/20">
                      {((segment?.normalized_duration_ms ?? segment?.original_duration_ms ?? 0) / 1000).toFixed(1)}s
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Analytics Stats */}
          {variantAnalytics ? (
            <>
              <div>
                <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-3">
                  Performance
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Views", value: variantAnalytics.total_views },
                    { label: "Unique Viewers", value: variantAnalytics.unique_viewers },
                    {
                      label: "Completion Rate",
                      value: `${variantAnalytics.completion_rate}%`,
                    },
                    { label: "Completions", value: variantAnalytics.complete_count },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <p className="text-[10px] text-white/25">{stat.label}</p>
                      <p className="mt-0.5 font-mono text-lg tabular-nums text-white/70">
                        {typeof stat.value === "number"
                          ? stat.value.toLocaleString()
                          : stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Funnel */}
              {variantAnalytics.play_count > 0 && (
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-3">
                    Engagement Funnel
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { label: "Play", value: variantAnalytics.play_count },
                      { label: "25%", value: variantAnalytics.progress_25_count },
                      { label: "50%", value: variantAnalytics.progress_50_count },
                      { label: "75%", value: variantAnalytics.progress_75_count },
                      { label: "Complete", value: variantAnalytics.complete_count },
                    ].map((step) => {
                      const pct =
                        variantAnalytics.play_count > 0
                          ? (step.value / variantAnalytics.play_count) * 100
                          : 0;
                      return (
                        <div key={step.label} className="flex items-center gap-3">
                          <span className="w-16 text-right text-[11px] text-white/30">
                            {step.label}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/50 transition-all duration-500"
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-mono text-[11px] tabular-nums text-white/40">
                            {step.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-xs text-white/25">No analytics data yet</p>
            </div>
          )}

          {/* Status */}
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-2">
              Status
            </h4>
            <div className="flex items-center gap-3 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  variant.weight > 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-zinc-500/10 text-zinc-500"
                }`}
              >
                {variant.weight > 0 ? "Active" : "Disabled"}
              </span>
              <span className="text-white/20">
                Weight: {variant.weight}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
