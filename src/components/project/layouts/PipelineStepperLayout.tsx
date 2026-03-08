/**
 * Layout E: "Pipeline Stepper" — Content organized by workflow stage
 *
 * Horizontal stepper: Upload > Process > Test > Analyze
 * Shows where the user is in the project lifecycle.
 * Active step is expanded, completed steps show summary chips.
 */

"use client";

import { useState, useMemo } from "react";
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
import { SegmentActionsBar } from "@/components/project/SegmentActionsBar";
import { ActivityLog } from "@/components/project/ActivityLog";
import {
  StatusBadge,
  FailureBanner,
  ProcessButtonSection,
} from "./shared-parts";
import type { ProjectLayoutProps } from "./types";

interface Step {
  id: string;
  label: string;
  description: string;
  status: "completed" | "active" | "upcoming";
}

export function PipelineStepperLayout(props: ProjectLayoutProps) {
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const totalSegments = segments.length;
  const hasAllSegmentTypes = hooks.length > 0 && bodies.length > 0 && ctas.length > 0;
  const isProcessing = project.status === "processing";
  const hasRendered = renderedVariants.length > 0;
  const hasAnalytics = analytics?.summary && analytics.summary.totalViews > 0;

  // Determine workflow stage
  const steps: Step[] = useMemo(() => {
    // Upload stage
    const uploadStatus: Step["status"] = hasAllSegmentTypes ? "completed" : "active";

    // Process stage
    let processStatus: Step["status"] = "upcoming";
    if (isProcessing) processStatus = "active";
    else if (hasRendered) processStatus = "completed";
    else if (hasAllSegmentTypes) processStatus = "active";

    // Test stage
    let testStatus: Step["status"] = "upcoming";
    if (hasRendered && hasAnalytics) testStatus = "completed";
    else if (hasRendered) testStatus = "active";

    // Analyze stage
    let analyzeStatus: Step["status"] = "upcoming";
    if (hasAnalytics) analyzeStatus = "active";

    return [
      { id: "upload", label: "Upload", description: `${totalSegments} segments`, status: uploadStatus },
      { id: "process", label: "Process", description: hasRendered ? `${renderedVariants.length} variants` : "Normalize & render", status: processStatus },
      { id: "test", label: "Test", description: hasRendered ? `${isSplitTest ? "Split testing" : "Single variant"}` : "A/B test variants", status: testStatus },
      { id: "analyze", label: "Analyze", description: hasAnalytics ? `${analytics!.summary!.totalViews} views` : "Track performance", status: analyzeStatus },
    ];
  }, [totalSegments, hasAllSegmentTypes, isProcessing, hasRendered, hasAnalytics, renderedVariants.length, isSplitTest, analytics]);

  // Which step is currently viewed (user can click any completed/active step)
  const currentActiveStep = steps.find((s) => s.status === "active")?.id || steps[0].id;
  const [viewingStep, setViewingStep] = useState<string>(currentActiveStep);

  return (
    <div className="space-y-6">
      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
          <button
            onClick={onRefresh}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
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
      {isProcessing && <ProcessingTips />}

      {/* ── Failure Banner ── */}
      {hasFailures && (
        <FailureBanner
          projectId={projectId}
          failedSegments={failedSegments}
          failedVariants={failedVariants}
          onRetry={onRefresh}
        />
      )}

      {/* ── Pipeline Stepper ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center">
          {steps.map((step, i) => {
            const isCompleted = step.status === "completed";
            const isActive = step.status === "active";
            const isViewing = viewingStep === step.id;
            const isClickable = step.status !== "upcoming";

            return (
              <div key={step.id} className="flex flex-1 items-center">
                {/* Step circle + content */}
                <button
                  onClick={isClickable ? () => setViewingStep(step.id) : undefined}
                  disabled={!isClickable}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                    isClickable ? "hover:bg-white/[0.03]" : "cursor-default"
                  } ${isViewing ? "bg-white/[0.04]" : ""}`}
                >
                  {/* Circle */}
                  <div
                    className={`
                      flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all
                      ${isCompleted ? "border-emerald-500 bg-emerald-500/20" : ""}
                      ${isActive ? "border-primary bg-primary/10" : ""}
                      ${!isCompleted && !isActive ? "border-white/10 bg-white/[0.02]" : ""}
                    `}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isActive ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-white/10" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="text-left">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted
                          ? "text-emerald-400"
                          : isActive
                            ? "text-white/90"
                            : "text-white/25"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-[11px] ${
                        isCompleted || isActive ? "text-white/30" : "text-white/15"
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </button>

                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="mx-1 flex-1">
                    <div
                      className={`h-[2px] rounded-full ${
                        isCompleted ? "bg-emerald-500/40" : "bg-white/[0.06]"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-6">
        {/* Upload step */}
        {viewingStep === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/40">
                Uploaded Segments
              </h2>
              <Link href={`/projects/${projectId}/upload`}>
                <Button variant="outline" size="sm">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add More
                </Button>
              </Link>
            </div>
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

        {/* Process step */}
        {viewingStep === "process" && (
          <div className="space-y-4">
            {isProcessing ? (
              <ProcessingProgress projectId={projectId} onComplete={onRefresh} />
            ) : hasRendered ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <p className="text-sm font-medium text-emerald-400">
                    All {renderedVariants.length} variants rendered successfully
                  </p>
                </div>
                <p className="text-center text-xs text-white/20">
                  Processing complete. View your variants in the Test step.
                </p>
              </div>
            ) : hasAllSegmentTypes ? (
              <ProcessButtonSection projectId={projectId} onProcess={onRefresh} />
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">
                  Upload at least one hook, one body, and one CTA to start processing.
                </p>
                <Link href={`/projects/${projectId}/upload`} className="mt-3 inline-block">
                  <Button variant="outline" size="sm">Go to Upload</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Test step */}
        {viewingStep === "test" && (
          <div className="space-y-4">
            {hasRendered ? (
              <>
                {analytics?.summary?.topPerformer && (
                  <TopPerformerCard
                    topPerformer={analytics.summary.topPerformer}
                    variantCount={renderedVariants.length}
                  />
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white/80">Variants</h3>
                    <p className="text-xs text-white/30">
                      {renderedVariants.length} of {variants.length} rendered
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {renderedVariants.length > 0 && (
                      <Link href={`/projects/${projectId}/preview`}>
                        <Button variant="outline" size="sm">Preview</Button>
                      </Link>
                    )}
                    {renderedVariants.length > 0 && (
                      <Link href={`/projects/${projectId}/embed`}>
                        <Button size="sm">Get Embed Code</Button>
                      </Link>
                    )}
                  </div>
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
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">
                  Process your segments first to generate testable variants.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Analyze step */}
        {viewingStep === "analyze" && (
          <div className="space-y-4">
            {hasAnalytics ? (
              <>
                <AnalyticsSummary summary={analytics!.summary!} />
                <AnalyticsDashboard projectId={projectId} isSplitTest={isSplitTest} />
              </>
            ) : hasRendered ? (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">
                  Embed your video and start collecting viewer data.
                </p>
                <Link href={`/projects/${projectId}/embed`} className="mt-3 inline-block">
                  <Button size="sm">Get Embed Code</Button>
                </Link>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">
                  Analytics will appear here once you have rendered variants and embedded them.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

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
