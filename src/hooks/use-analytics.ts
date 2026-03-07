/**
 * use-analytics.ts — TanStack Query hook for project analytics
 *
 * Fetches variant-level and segment-level analytics from the API.
 * Auto-refreshes every 30 seconds when the window is focused.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

export interface VariantAnalytics {
  variant_id: string;
  variant_code: string;
  custom_name: string | null;
  total_views: number;
  unique_viewers: number;
  play_count: number;
  progress_25_count: number;
  progress_50_count: number;
  progress_75_count: number;
  complete_count: number;
  completion_rate: number;
}

export interface SegmentAnalytics {
  segment_id: string;
  segment_label: string;
  total_views: number;
  unique_viewers: number;
  complete_count: number;
  completion_rate: number;
}

export interface DailyView {
  day: string;
  variant_id: string;
  variant_code: string;
  views: number;
  completions: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalCompletions: number;
  overallCompletionRate: number;
  topPerformer: VariantAnalytics | null;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  variants: VariantAnalytics[];
  dailyViews: DailyView[];
  segmentAnalytics: SegmentAnalytics[] | null;
}

interface UseAnalyticsOptions {
  projectId: string;
  startDate?: string | null;
  endDate?: string | null;
  segmentType?: "hook" | "body" | "cta" | null;
  enabled?: boolean;
}

async function fetchAnalytics({
  projectId,
  startDate,
  endDate,
  segmentType,
}: UseAnalyticsOptions): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (segmentType) params.set("segmentType", segmentType);

  const qs = params.toString();
  const url = `/api/projects/${projectId}/analytics${qs ? `?${qs}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch analytics");
  }
  return res.json();
}

export function useAnalytics({
  projectId,
  startDate = null,
  endDate = null,
  segmentType = null,
  enabled = true,
}: UseAnalyticsOptions) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", projectId, startDate, endDate, segmentType],
    queryFn: () =>
      fetchAnalytics({ projectId, startDate, endDate, segmentType }),
    enabled,
    refetchInterval: 30_000, // Auto-refresh every 30s
    refetchIntervalInBackground: false, // Only when tab is focused
  });
}
