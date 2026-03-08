/**
 * Layout D: "Bento Grid" — Compact dashboard grid layout
 *
 * Everything visible at once in a dense grid. Click any cell to expand.
 * Apple-style bento density with precise spacing and consistent rounding.
 * No scrolling needed for overview.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProcessingProgress } from "@/components/project/ProcessingProgress";
import { SegmentTypeSection } from "@/components/project/SegmentTypeSection";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { VariantCard } from "@/components/project/VariantCard";
import { VariantDetailPanel } from "@/components/project/VariantDetailPanel";
import { ProcessingTips } from "@/components/project/ProcessingTips";
import { SegmentActionsBar } from "@/components/project/SegmentActionsBar";
import { ActivityLog } from "@/components/project/ActivityLog";
import {
  StatusBadge,
  SplitTestIndicator,
  FailureBanner,
  ProcessButtonSection,
} from "./shared-parts";
import type { ProjectLayoutProps } from "./types";

type ExpandedCell =
  | null
  | "segments"
  | "variants"
  | "analytics"
  | "processing";

function BentoCell({
  children,
  className = "",
  onClick,
  expandable = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  expandable?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 transition-all
        ${expandable ? "cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.1]" : ""}
        ${className}
      `}
    >
      {children}
      {expandable && (
        <div className="absolute top-3 right-3">
          <svg
            className="h-3.5 w-3.5 text-white/15"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function BentoGridLayout(props: ProjectLayoutProps) {
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

  const [expanded, setExpanded] = useState<ExpandedCell>(null);

  const canProcess =
    hooks.length > 0 &&
    bodies.length > 0 &&
    ctas.length > 0 &&
    project.status === "draft";

  const hasAnalyticsData = analytics?.summary && analytics.summary.totalViews > 0;

  // Expanded overlay panel
  if (expanded) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setExpanded(null)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/[0.04] hover:text-white/70"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to dashboard
        </button>

        {expanded === "segments" && (
          <div className="space-y-3">
            <SegmentTypeSection type="hook" segments={hooks} bestSegmentId={bestSegmentIds.hook} />
            <SegmentTypeSection type="body" segments={bodies} bestSegmentId={bestSegmentIds.body} />
            <SegmentTypeSection type="cta" segments={ctas} bestSegmentId={bestSegmentIds.cta} />
            <SegmentActionsBar
              projectId={projectId}
              canReprocess={hooks.length > 0 && bodies.length > 0 && ctas.length > 0 && (project.status === "draft" || project.status === "ready")}
              isProcessing={project.status === "processing"}
              onReprocess={onRefresh}
            />
          </div>
        )}
        {expanded === "variants" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white/80">Variants</h3>
                <p className="text-xs text-white/30">{renderedVariants.length} of {variants.length} rendered</p>
              </div>
              {renderedVariants.length > 0 && (
                <Link href={`/projects/${projectId}/preview`}>
                  <Button variant="outline" size="sm">Preview</Button>
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
          </div>
        )}
        {expanded === "analytics" && (
          <AnalyticsDashboard projectId={projectId} isSplitTest={isSplitTest} />
        )}
        {expanded === "processing" && (
          <ProcessingProgress projectId={projectId} onComplete={onRefresh} />
        )}

        {/* Variant Detail Panel */}
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

  return (
    <div className="space-y-4">
      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
          {renderedVariants.length > 0 && (
            <SplitTestIndicator
              isSplitTest={isSplitTest}
              activeCount={activeVariants.length}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
            </svg>
          </button>
          <Link href={`/projects/${projectId}/upload`}>
            <Button variant="outline" size="sm">Upload</Button>
          </Link>
          {renderedVariants.length > 0 && (
            <Link href={`/projects/${projectId}/embed`}>
              <Button size="sm">Embed Code</Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Processing Tips ── */}
      {project.status === "processing" && <ProcessingTips />}

      {/* ── Failure Banner ── */}
      {hasFailures && (
        <FailureBanner
          projectId={projectId}
          failedSegments={failedSegments}
          failedVariants={failedVariants}
          onRetry={onRefresh}
        />
      )}

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Row 1: Key Metrics */}
        {hasAnalyticsData ? (
          <>
            <BentoCell>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
                Total Views
              </p>
              <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white/90">
                {analytics!.summary!.totalViews.toLocaleString()}
              </p>
            </BentoCell>
            <BentoCell>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
                Completion Rate
              </p>
              <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white/90">
                {analytics!.summary.overallCompletionRate}%
              </p>
            </BentoCell>
            <BentoCell>
              {analytics!.summary!.topPerformer ? (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-amber-400/50">
                    Top Performer
                  </p>
                  <p className="mt-2 text-lg font-semibold text-amber-300">
                    {analytics!.summary!.topPerformer.variant_code}
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">
                    <span className="font-mono text-amber-400/80">
                      {analytics!.summary!.topPerformer.completion_rate}%
                    </span>{" "}
                    completion
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">
                    Completions
                  </p>
                  <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white/90">
                    {analytics!.summary.totalCompletions.toLocaleString()}
                  </p>
                </>
              )}
            </BentoCell>
          </>
        ) : project.status === "processing" ? (
          <BentoCell className="col-span-3" expandable onClick={() => setExpanded("processing")}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="h-4 w-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-amber-300">Processing in progress</p>
                <p className="text-xs text-white/30">Click to view detailed progress</p>
              </div>
            </div>
          </BentoCell>
        ) : (
          <BentoCell className="col-span-3">
            <p className="text-center text-sm text-white/20 py-2">
              Upload segments and process variants to see metrics here.
            </p>
          </BentoCell>
        )}

        {/* Row 2: Segments + Variants */}
        {/* Segments summary */}
        <BentoCell expandable onClick={() => setExpanded("segments")}>
          <p className="text-[10px] font-medium uppercase tracking-widest text-blue-400/50 mb-3">
            Segments
          </p>
          <div className="space-y-2">
            {[
              { label: "Hooks", count: hooks.length, dot: "bg-blue-400" },
              { label: "Bodies", count: bodies.length, dot: "bg-amber-400" },
              { label: "CTAs", count: ctas.length, dot: "bg-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span className="text-xs text-white/40">{s.label}</span>
                </div>
                <span className="font-mono text-sm font-medium text-white/60">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </BentoCell>

        {/* Variants grid (2 cols) */}
        <BentoCell
          className="col-span-2"
          expandable={variants.length > 0}
          onClick={variants.length > 0 ? () => setExpanded("variants") : undefined}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-amber-400/50">
              Variants
            </p>
            {variants.length > 0 && (
              <span className="text-[10px] text-white/20">
                {renderedVariants.length}/{variants.length} rendered
              </span>
            )}
          </div>
          {variants.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {variants.slice(0, 9).map((v) => {
                const isRendered = v.status === "rendered";
                const isFailed = v.status === "failed";
                return (
                  <div
                    key={v.id}
                    className={`
                      rounded-lg border px-2.5 py-1.5 text-center text-xs font-mono
                      ${isRendered ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400/70" : ""}
                      ${isFailed ? "border-red-500/20 bg-red-500/5 text-red-400/70" : ""}
                      ${!isRendered && !isFailed ? "border-white/5 bg-white/[0.02] text-white/30" : ""}
                    `}
                  >
                    {v.variant_code}
                  </div>
                );
              })}
              {variants.length > 9 && (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-center text-xs text-white/20">
                  +{variants.length - 9}
                </div>
              )}
            </div>
          ) : canProcess ? (
            <ProcessButtonSection projectId={projectId} onProcess={onRefresh} />
          ) : (
            <p className="text-xs text-white/20 py-2">No variants yet</p>
          )}
        </BentoCell>

        {/* Row 3: Analytics / Engagement preview */}
        {hasAnalyticsData && (
          <BentoCell
            className="col-span-3"
            expandable
            onClick={() => setExpanded("analytics")}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/50">
                Engagement Funnel
              </p>
              <span className="text-[10px] text-white/20">Click to expand full analytics</span>
            </div>
            {/* Mini funnel bars */}
            <div className="flex items-end gap-2 h-16">
              {["Play", "25%", "50%", "75%", "Complete"].map((step, i) => {
                const heights = [100, 80, 65, 50, analytics!.summary!.topPerformer?.completion_rate || 35];
                return (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-sm bg-gradient-to-t from-primary/40 to-primary/20 transition-all"
                      style={{ height: `${heights[i]}%` }}
                    />
                    <span className="text-[9px] text-white/20">{step}</span>
                  </div>
                );
              })}
            </div>
          </BentoCell>
        )}
      </div>

      {/* ── Activity Log ── */}
      <ActivityLog projectId={projectId} />

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
