/**
 * AnalyticsSummary — Compact analytics overview card
 *
 * Shows total views, completion rate, and top performer at a glance.
 * Only renders when there's analytics data to show.
 */

"use client";

import type { AnalyticsSummary as AnalyticsSummaryType } from "@/hooks/use-analytics";

interface AnalyticsSummaryProps {
  summary: AnalyticsSummaryType;
}

export function AnalyticsSummary({ summary }: AnalyticsSummaryProps) {
  if (summary.totalViews === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Total Views */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
          Total Views
        </p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white/90 font-mono">
          {summary.totalViews.toLocaleString()}
        </p>
      </div>

      {/* Completion Rate */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
          Completion Rate
        </p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white/90 font-mono">
          {summary.overallCompletionRate}%
        </p>
      </div>

      {/* Total Completions */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
          Completions
        </p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white/90 font-mono">
          {summary.totalCompletions.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
