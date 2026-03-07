/**
 * AnalyticsDashboard — Full analytics view for a project
 *
 * Shows metric cards, area chart, variant table, and segment comparison.
 * Adapts between split test mode (multi-variant) and single video mode.
 */

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAnalytics } from "@/hooks/use-analytics";
import { DateRangePicker } from "./DateRangePicker";
import { MetricCard } from "./MetricCard";
import { AnalyticsChart } from "./AnalyticsChart";
import { AnalyticsTable } from "./AnalyticsTable";
import { SegmentComparison } from "./SegmentComparison";
import { CustomMetricsConfig } from "./CustomMetricsConfig";

interface AnalyticsDashboardProps {
  projectId: string;
  isSplitTest: boolean;
}

type ChartMetric = "views" | "completions";
type SegmentTab = "hook" | "body" | "cta" | null;

interface CustomMetricSummary {
  id: string;
  name: string;
  metric_type: string;
  event_count: number;
}

function useCustomMetricsSummary(projectId: string) {
  return useQuery<{ metrics: CustomMetricSummary[] }>({
    queryKey: ["custom-metrics-summary", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/metrics`);
      if (!res.ok) return { metrics: [] };
      const data = await res.json();
      return { metrics: data.metrics || [] };
    },
  });
}

export function AnalyticsDashboard({
  projectId,
  isSplitTest,
}: AnalyticsDashboardProps) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("views");
  const [segmentTab, setSegmentTab] = useState<SegmentTab>(null);
  const [metricsConfigOpen, setMetricsConfigOpen] = useState(false);

  const { data: customMetricsData } = useCustomMetricsSummary(projectId);
  const customMetrics = customMetricsData?.metrics || [];

  const { data: analytics, isLoading } = useAnalytics({
    projectId,
    startDate,
    endDate,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-white/5"
            />
          ))}
        </div>
        <div className="h-[280px] animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (!analytics || analytics.summary.totalViews === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-8 py-12 text-center">
        <svg
          className="mx-auto h-8 w-8 text-white/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        <p className="mt-3 text-sm text-white/40">
          No analytics data yet
        </p>
        <p className="mt-1 text-xs text-white/20">
          Views will appear here once your embed starts receiving traffic
        </p>
      </div>
    );
  }

  const { summary, variants, dailyViews } = analytics;
  const variantCodes = variants.map((v) => v.variant_code);

  // Progress funnel: play → 25% → 50% → 75% → complete
  const totalPlays = variants.reduce((s, v) => s + (v.play_count || 0), 0);
  const total25 = variants.reduce(
    (s, v) => s + (v.progress_25_count || 0),
    0
  );
  const total50 = variants.reduce(
    (s, v) => s + (v.progress_50_count || 0),
    0
  );
  const total75 = variants.reduce(
    (s, v) => s + (v.progress_75_count || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/70">
          {isSplitTest ? "Split Test Analytics" : "Video Analytics"}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMetricsConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-white/30 transition-colors hover:bg-white/5 hover:text-white/50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Metrics
          </button>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Views"
          value={summary.totalViews}
          active={chartMetric === "views"}
          onClick={() => setChartMetric("views")}
        />
        <MetricCard
          label="Completion Rate"
          value={`${summary.overallCompletionRate}%`}
          active={chartMetric === "completions"}
          onClick={() => setChartMetric("completions")}
        />
        <MetricCard label="Completions" value={summary.totalCompletions} />
        <MetricCard
          label="Unique Viewers"
          value={variants.reduce((s, v) => s + (v.unique_viewers || 0), 0)}
        />
      </div>

      {/* Progress funnel */}
      {totalPlays > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-3">
            Engagement Funnel
          </h4>
          <div className="flex items-end gap-1 h-16">
            {[
              { label: "Play", value: totalPlays },
              { label: "25%", value: total25 },
              { label: "50%", value: total50 },
              { label: "75%", value: total75 },
              { label: "Done", value: summary.totalCompletions },
            ].map((step) => {
              const pct =
                totalPlays > 0 ? (step.value / totalPlays) * 100 : 0;
              return (
                <div
                  key={step.label}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-mono tabular-nums text-white/40">
                    {step.value}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/40 transition-all duration-500"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[10px] text-white/25">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      <AnalyticsChart
        dailyViews={dailyViews}
        metric={chartMetric}
        variantCodes={variantCodes}
      />

      {/* Variant table (split test only) */}
      {isSplitTest && variants.length > 1 && (
        <AnalyticsTable variants={variants} />
      )}

      {/* Segment comparison tabs */}
      {isSplitTest && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            {(["hook", "body", "cta"] as const).map((type) => (
              <button
                key={type}
                onClick={() =>
                  setSegmentTab(segmentTab === type ? null : type)
                }
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  segmentTab === type
                    ? "bg-white/10 text-white/80"
                    : "text-white/30 hover:bg-white/5 hover:text-white/50"
                }`}
              >
                {type === "hook"
                  ? "Hooks"
                  : type === "body"
                    ? "Bodies"
                    : "CTAs"}
              </button>
            ))}
          </div>

          {segmentTab && (
            <SegmentComparison
              projectId={projectId}
              segmentType={segmentTab}
              startDate={startDate}
              endDate={endDate}
            />
          )}
        </div>
      )}

      {/* Custom metric cards */}
      {customMetrics.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/30">
            Custom Metrics
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customMetrics.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <p className="text-[11px] text-white/30">{m.name}</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-white/70">
                  {m.event_count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom metrics config dialog */}
      <CustomMetricsConfig
        projectId={projectId}
        open={metricsConfigOpen}
        onClose={() => setMetricsConfigOpen(false)}
      />
    </div>
  );
}
