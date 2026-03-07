/**
 * TopPerformerCard — Highlights the best-performing variant
 *
 * Shows an amber/gold card with the top variant by completion rate.
 * Only visible when there are 2+ variants with view data.
 */

"use client";

import type { VariantAnalytics } from "@/hooks/use-analytics";

interface TopPerformerCardProps {
  topPerformer: VariantAnalytics;
  variantCount: number;
}

export function TopPerformerCard({
  topPerformer,
  variantCount,
}: TopPerformerCardProps) {
  // Only show when split testing (2+ variants)
  if (variantCount < 2 || topPerformer.total_views === 0) return null;

  const displayName =
    topPerformer.custom_name || topPerformer.variant_code;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
      <div className="flex items-center gap-3">
        {/* Trophy icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
          <svg
            className="h-5 w-5 text-amber-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-300">
              Top Performer
            </span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400/80">
              {displayName}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-white/40">
            <span>
              <span className="font-mono tabular-nums text-white/60">
                {topPerformer.completion_rate}%
              </span>{" "}
              completion
            </span>
            <span className="text-white/10">|</span>
            <span>
              <span className="font-mono tabular-nums text-white/60">
                {topPerformer.total_views.toLocaleString()}
              </span>{" "}
              views
            </span>
            <span className="text-white/10">|</span>
            <span>
              <span className="font-mono tabular-nums text-white/60">
                {topPerformer.complete_count.toLocaleString()}
              </span>{" "}
              completions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
