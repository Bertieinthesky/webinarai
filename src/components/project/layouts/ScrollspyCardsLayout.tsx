/**
 * Layout C: "Scrollspy Cards" — Airy scrollable layout with sticky navigation
 *
 * Vertical scroll with generous spacing between distinct section cards.
 * Sticky pill nav at top tracks which section is in view.
 * Each section has a colored left accent border.
 * Jump-to-section navigation.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface Section {
  id: string;
  label: string;
  color: string;
  accentBorder: string;
}

export function ScrollspyCardsLayout(props: ProjectLayoutProps) {
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

  const canProcess =
    hooks.length > 0 &&
    bodies.length > 0 &&
    ctas.length > 0 &&
    project.status === "draft";

  // Build visible sections dynamically
  const sections: Section[] = [
    { id: "overview", label: "Overview", color: "text-primary", accentBorder: "border-l-primary/40" },
    { id: "segments", label: "Segments", color: "text-blue-400", accentBorder: "border-l-blue-400/40" },
  ];
  if (variants.length > 0 || canProcess) {
    sections.push({ id: "variants", label: "Variants", color: "text-amber-400", accentBorder: "border-l-amber-400/40" });
  }
  if (renderedVariants.length > 0) {
    sections.push({ id: "analytics", label: "Analytics", color: "text-emerald-400", accentBorder: "border-l-emerald-400/40" });
  }

  const [activeSection, setActiveSection] = useState(sections[0]?.id || "overview");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scrollspy: track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    );

    for (const section of sections) {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections.map((s) => s.id).join(",")]);

  const scrollTo = useCallback((sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
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

      {/* ── Sticky Navigation ── */}
      <div className="sticky top-0 z-20 -mx-2 px-2 py-2 backdrop-blur-xl bg-[hsl(220_14%_5.5%)]/80">
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollTo(section.id)}
                className={`
                  rounded-lg px-4 py-2 text-sm font-medium transition-all
                  ${
                    isActive
                      ? `bg-white/[0.06] ${section.color}`
                      : "text-white/30 hover:text-white/50 hover:bg-white/[0.02]"
                  }
                `}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section Cards ── */}
      <div className="space-y-8">
        {/* Overview */}
        <div
          id="overview"
          ref={(el) => { sectionRefs.current.overview = el; }}
          className="scroll-mt-20 rounded-xl border border-white/[0.06] border-l-2 border-l-primary/40 bg-white/[0.02] p-6"
        >
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-primary/60">
            Overview
          </h2>
          <div className="space-y-4">
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
            {/* Empty state for overview */}
            {!analytics?.summary && project.status !== "processing" && (
              <p className="py-4 text-center text-sm text-white/20">
                Upload segments and process variants to see analytics here.
              </p>
            )}
          </div>
        </div>

        {/* Segments */}
        <div
          id="segments"
          ref={(el) => { sectionRefs.current.segments = el; }}
          className="scroll-mt-20 rounded-xl border border-white/[0.06] border-l-2 border-l-blue-400/40 bg-white/[0.02] p-6"
        >
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-blue-400/60">
            Segments
          </h2>
          <div className="space-y-3">
            <SegmentTypeSection type="hook" segments={hooks} bestSegmentId={bestSegmentIds.hook} />
            <SegmentTypeSection type="body" segments={bodies} bestSegmentId={bestSegmentIds.body} />
            <SegmentTypeSection type="cta" segments={ctas} bestSegmentId={bestSegmentIds.cta} />
          </div>
        </div>

        {/* Variants */}
        {(variants.length > 0 || canProcess) && (
          <div
            id="variants"
            ref={(el) => { sectionRefs.current.variants = el; }}
            className="scroll-mt-20 rounded-xl border border-white/[0.06] border-l-2 border-l-amber-400/40 bg-white/[0.02] p-6"
          >
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-amber-400/60">
              Variants
            </h2>
            {project.status !== "processing" && variants.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/30">
                    {renderedVariants.length} of {variants.length} rendered
                  </p>
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
              </div>
            )}
            {canProcess && (
              <div className="mt-4">
                <ProcessButtonSection projectId={projectId} onProcess={onRefresh} />
              </div>
            )}
          </div>
        )}

        {/* Analytics */}
        {renderedVariants.length > 0 && (
          <div
            id="analytics"
            ref={(el) => { sectionRefs.current.analytics = el; }}
            className="scroll-mt-20 rounded-xl border border-white/[0.06] border-l-2 border-l-emerald-400/40 bg-white/[0.02] p-6"
          >
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-emerald-400/60">
              Analytics
            </h2>
            <AnalyticsDashboard projectId={projectId} isSplitTest={isSplitTest} />
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
