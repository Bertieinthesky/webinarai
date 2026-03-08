/**
 * Layout A: "Tabbed Folio" — File cabinet folder tabs
 *
 * Physical folder-tab styling with one section visible at a time.
 * Tabs: Overview | Segments | Variants | Analytics
 * Active tab connects seamlessly to the content panel below.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProcessingProgress } from "@/components/project/ProcessingProgress";
import { SegmentTypeSection } from "@/components/project/SegmentTypeSection";
import { AnalyticsSummary } from "@/components/project/AnalyticsSummary";
import { TopPerformerCard } from "@/components/project/TopPerformerCard";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { VariantCard } from "@/components/project/VariantCard";
import { VariantDetailPanel } from "@/components/project/VariantDetailPanel";
import { ProcessingTips } from "@/components/project/ProcessingTips";
import {
  StatusBadge,
  SplitTestIndicator,
  FailureBanner,
  ProcessButtonSection,
} from "./shared-parts";
import type { ProjectLayoutProps } from "./types";

const TABS = [
  { id: "overview", label: "Overview", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
  { id: "segments", label: "Segments", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" },
  { id: "variants", label: "Variants", icon: "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" },
  { id: "analytics", label: "Analytics", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TabbedFolioLayout(props: ProjectLayoutProps) {
  const {
    project,
    segments,
    variants,
    analytics,
    projectId,
    hooks,
    bodies,
    ctas,
    renderedVariants,
    activeVariants,
    failedSegments,
    failedVariants,
    isSplitTest,
    hasFailures,
    bestSegmentIds,
    selectedVariantId,
    onRefresh,
    onSelectVariant,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const canProcess =
    hooks.length > 0 &&
    bodies.length > 0 &&
    ctas.length > 0 &&
    project.status === "draft";

  return (
    <div className="space-y-0">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
            <button
              onClick={onRefresh}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
              </svg>
            </button>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Created{" "}
              {new Date(project.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {renderedVariants.length > 0 && (
              <SplitTestIndicator
                isSplitTest={isSplitTest}
                activeCount={activeVariants.length}
              />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}/upload`}>
            <Button variant="outline">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Segments
            </Button>
          </Link>
          {renderedVariants.length > 0 && (
            <Link href={`/projects/${projectId}/embed`}>
              <Button>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                Get Embed Code
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Processing Tips ── */}
      {project.status === "processing" && (
        <div className="mb-6">
          <ProcessingTips />
        </div>
      )}

      {/* ── Failure Banner ── */}
      {hasFailures && (
        <div className="mb-6">
          <FailureBanner
            projectId={projectId}
            failedSegments={failedSegments}
            failedVariants={failedVariants}
            onRetry={onRefresh}
          />
        </div>
      )}

      {/* ── Folder Tabs ── */}
      <div className="relative">
        {/* Tab bar */}
        <div className="flex items-end gap-0.5 px-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            // Hide analytics tab if no data
            if (tab.id === "analytics" && renderedVariants.length === 0) return null;
            // Hide variants tab if none exist
            if (tab.id === "variants" && variants.length === 0 && !canProcess) return null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 rounded-t-lg px-5 py-2.5 text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-white/[0.04] text-white/90 z-10"
                      : "bg-white/[0.015] text-white/40 hover:bg-white/[0.03] hover:text-white/60"
                  }
                `}
                style={{
                  // Physical folder tab: slight trapezoid shape
                  clipPath: isActive
                    ? "polygon(4px 0%, calc(100% - 4px) 0%, 100% 100%, 0% 100%)"
                    : "polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%)",
                }}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
                {/* Active indicator line */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content panel — seamlessly connected to active tab */}
        <div className="rounded-xl rounded-tl-none border border-white/[0.06] bg-white/[0.04] p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {analytics?.summary && (
                <AnalyticsSummary summary={analytics.summary} />
              )}
              {analytics?.summary?.topPerformer && (
                <TopPerformerCard
                  topPerformer={analytics.summary.topPerformer}
                  variantCount={renderedVariants.length}
                />
              )}
              {project.status === "processing" && (
                <ProcessingProgress projectId={projectId} onComplete={onRefresh} />
              )}
              {/* Quick segment count when not on segments tab */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: "Hooks", count: hooks.length, color: "text-blue-400" },
                  { type: "Bodies", count: bodies.length, color: "text-amber-400" },
                  { type: "CTAs", count: ctas.length, color: "text-emerald-400" },
                ].map((s) => (
                  <button
                    key={s.type}
                    onClick={() => setActiveTab("segments")}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <p className={`text-xs font-medium uppercase tracking-wider ${s.color}/60`}>
                      {s.type}
                    </p>
                    <p className="mt-1 text-2xl font-semibold font-mono text-white/80">
                      {s.count}
                    </p>
                    <p className="text-xs text-white/20 mt-0.5">
                      segment{s.count !== 1 ? "s" : ""} uploaded
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Segments Tab */}
          {activeTab === "segments" && (
            <div className="space-y-3">
              <SegmentTypeSection type="hook" segments={hooks} bestSegmentId={bestSegmentIds.hook} />
              <SegmentTypeSection type="body" segments={bodies} bestSegmentId={bestSegmentIds.body} />
              <SegmentTypeSection type="cta" segments={ctas} bestSegmentId={bestSegmentIds.cta} />
            </div>
          )}

          {/* Variants Tab */}
          {activeTab === "variants" && (
            <div className="space-y-4">
              {project.status !== "processing" && variants.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/30">
                        {renderedVariants.length} of {variants.length} rendered
                      </p>
                    </div>
                    {renderedVariants.length > 0 && (
                      <Link href={`/projects/${projectId}/preview`}>
                        <Button variant="outline" size="sm">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                          </svg>
                          Preview
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {variants.map((v) => {
                      const va = analytics?.variants?.find((a) => a.variant_id === v.id);
                      return (
                        <VariantCard
                          key={v.id}
                          variant={v}
                          projectId={projectId}
                          analytics={va ? { total_views: va.total_views, completion_rate: va.completion_rate, complete_count: va.complete_count } : undefined}
                          isTopPerformer={analytics?.summary?.topPerformer?.variant_id === v.id && renderedVariants.length > 1}
                          onUpdate={onRefresh}
                          onExpand={() => onSelectVariant(v.id)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
              {canProcess && (
                <ProcessButtonSection projectId={projectId} onProcess={onRefresh} />
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && renderedVariants.length > 0 && (
            <AnalyticsDashboard projectId={projectId} isSplitTest={isSplitTest} />
          )}
        </div>
      </div>

      {/* ── Variant Detail Panel ── */}
      {selectedVariantId && (() => {
        const selectedVariant = variants.find((v) => v.id === selectedVariantId);
        if (!selectedVariant) return null;
        return (
          <VariantDetailPanel
            variant={selectedVariant}
            segments={segments}
            projectId={projectId}
            onClose={() => onSelectVariant(null)}
          />
        );
      })()}
    </div>
  );
}
