/**
 * Layout B: "Split Cockpit" — Two-panel mission control layout
 *
 * Persistent left sidebar with project status, segment inventory, and quick stats.
 * Right main panel for variants, analytics, and processing.
 * Data-dense, always-visible context.
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
  FailureBanner,
  ProcessButtonSection,
} from "./shared-parts";
import type { ProjectLayoutProps } from "./types";

type RightPanel = "main" | "segments";

export function SplitCockpitLayout(props: ProjectLayoutProps) {
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

  const [rightPanel, setRightPanel] = useState<RightPanel>("main");

  const canProcess =
    hooks.length > 0 &&
    bodies.length > 0 &&
    ctas.length > 0 &&
    project.status === "draft";

  const totalSegments = segments.length;

  return (
    <div className="flex gap-6" style={{ minHeight: "calc(100vh - 8rem)" }}>
      {/* ── Left Sidebar ── */}
      <div className="w-64 shrink-0 space-y-5">
        {/* Project identity */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
            {project.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={project.status} />
            <button
              onClick={onRefresh}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Created{" "}
            {new Date(project.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* Quick stats */}
        {analytics?.summary && analytics.summary.totalViews > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
              Performance
            </p>
            {[
              { label: "Views", value: analytics.summary.totalViews.toLocaleString() },
              { label: "Completion", value: `${analytics.summary.overallCompletionRate}%` },
              { label: "Completions", value: analytics.summary.totalCompletions.toLocaleString() },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-xs text-white/30">{stat.label}</span>
                <span className="font-mono text-sm font-medium tabular-nums text-white/70">
                  {stat.value}
                </span>
              </div>
            ))}
            {/* Split test status */}
            {isSplitTest && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Split testing {activeVariants.length} variants
              </div>
            )}
            <div className="h-px bg-white/[0.06]" />
          </div>
        )}

        {/* Segment inventory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
              Segments
            </p>
            <span className="font-mono text-[10px] text-white/20">
              {totalSegments} total
            </span>
          </div>
          {[
            { type: "hook" as const, items: hooks, color: "bg-blue-400", label: "Hooks" },
            { type: "body" as const, items: bodies, color: "bg-amber-400", label: "Bodies" },
            { type: "cta" as const, items: ctas, color: "bg-emerald-400", label: "CTAs" },
          ].map((seg) => (
            <button
              key={seg.type}
              onClick={() => setRightPanel("segments")}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.03]"
            >
              <span className={`h-2 w-2 rounded-full ${seg.color}`} />
              <span className="flex-1 text-xs text-white/50">{seg.label}</span>
              <span className="font-mono text-xs font-medium text-white/30">
                {seg.items.length}
              </span>
            </button>
          ))}
        </div>

        {/* Variants count */}
        {variants.length > 0 && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
                Variants
              </p>
              <button
                onClick={() => setRightPanel("main")}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.03]"
              >
                <span className="text-xs text-white/50">
                  {renderedVariants.length} rendered
                </span>
                <span className="font-mono text-xs text-white/30">
                  / {variants.length}
                </span>
              </button>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="h-px bg-white/[0.06]" />
        <div className="space-y-2">
          <Link href={`/projects/${projectId}/upload`} className="block">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Segments
            </Button>
          </Link>
          {renderedVariants.length > 0 && (
            <Link href={`/projects/${projectId}/embed`} className="block">
              <Button size="sm" className="w-full justify-start">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                Get Embed Code
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Right Main Panel ── */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Processing Tips */}
        {project.status === "processing" && <ProcessingTips />}

        {/* Failure Banner */}
        {hasFailures && (
          <FailureBanner
            projectId={projectId}
            failedSegments={failedSegments}
            failedVariants={failedVariants}
            onRetry={onRefresh}
          />
        )}

        {/* Panel toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRightPanel("main")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              rightPanel === "main"
                ? "bg-white/[0.06] text-white/80"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            {renderedVariants.length > 0 ? "Variants & Analytics" : "Overview"}
          </button>
          <button
            onClick={() => setRightPanel("segments")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              rightPanel === "segments"
                ? "bg-white/[0.06] text-white/80"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Segment Details
          </button>
        </div>

        {rightPanel === "main" && (
          <div className="space-y-6">
            {/* Analytics Summary */}
            {analytics?.summary && (
              <AnalyticsSummary summary={analytics.summary} />
            )}
            {analytics?.summary?.topPerformer && (
              <TopPerformerCard
                topPerformer={analytics.summary.topPerformer}
                variantCount={renderedVariants.length}
              />
            )}

            {/* Processing */}
            {project.status === "processing" && (
              <ProcessingProgress projectId={projectId} onComplete={onRefresh} />
            )}

            {/* Variants */}
            {project.status !== "processing" && variants.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white/80">Variants</h3>
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
                <div className="grid gap-2 sm:grid-cols-2">
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
              </div>
            )}

            {/* Analytics Dashboard */}
            {renderedVariants.length > 0 && (
              <AnalyticsDashboard projectId={projectId} isSplitTest={isSplitTest} />
            )}

            {/* Process Button */}
            {canProcess && (
              <ProcessButtonSection projectId={projectId} onProcess={onRefresh} />
            )}
          </div>
        )}

        {rightPanel === "segments" && (
          <div className="space-y-3">
            <SegmentTypeSection type="hook" segments={hooks} bestSegmentId={bestSegmentIds.hook} />
            <SegmentTypeSection type="body" segments={bodies} bestSegmentId={bestSegmentIds.body} />
            <SegmentTypeSection type="cta" segments={ctas} bestSegmentId={bestSegmentIds.cta} />
          </div>
        )}
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
