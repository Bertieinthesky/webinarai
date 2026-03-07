/**
 * projects/[projectId]/page.tsx — Project detail and management page
 *
 * The central command center for a single project. Shows:
 *   - Split test status indicator
 *   - Analytics summary (when data exists)
 *   - Top performer card (for multi-variant projects)
 *   - Expandable segment sections with preview
 *   - Variant grid with inline naming and performance data
 *   - Processing progress (when active)
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessingProgress } from "@/components/project/ProcessingProgress";
import { SegmentTypeSection } from "@/components/project/SegmentTypeSection";
import { AnalyticsSummary } from "@/components/project/AnalyticsSummary";
import { TopPerformerCard } from "@/components/project/TopPerformerCard";
import { useAnalytics } from "@/hooks/use-analytics";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { VariantCard } from "@/components/project/VariantCard";
import { VariantDetailPanel } from "@/components/project/VariantDetailPanel";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

// ─── Status Config ──────────────────────────────────────────

const statusConfig: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  draft: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  processing: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  ready: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  archived: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-500",
    dot: "bg-zinc-500",
  },
};

const variantStatusConfig: Record<string, { bg: string; text: string }> = {
  rendered: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  rendering: { bg: "bg-amber-500/10", text: "text-amber-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400" },
  pending: { bg: "bg-zinc-500/10", text: "text-zinc-500" },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status === "processing" ? "animate-pulse" : ""}`}
      />
      {status}
    </span>
  );
}

// ─── Main Page Component ────────────────────────────────────

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Analytics data
  const { data: analytics } = useAnalytics({
    projectId,
    enabled: !!projectId,
  });

  const load = useCallback(async () => {
    const [projectRes, segmentsRes, variantsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("segments")
        .select("*")
        .eq("project_id", projectId)
        .order("type")
        .order("sort_order"),
      supabase
        .from("variants")
        .select("*")
        .eq("project_id", projectId)
        .order("variant_code"),
    ]);
    setProject(projectRes.data as Project | null);
    setSegments((segmentsRes.data as Segment[]) || []);
    setVariants((variantsRes.data as Variant[]) || []);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription for project status changes
  useEffect(() => {
    const channel = supabase
      .channel(`project-status-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase, load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>;
  }

  const hooks = segments.filter((s) => s.type === "hook");
  const bodies = segments.filter((s) => s.type === "body");
  const ctas = segments.filter((s) => s.type === "cta");
  const renderedVariants = variants.filter((v) => v.status === "rendered");
  const activeVariants = renderedVariants.filter((v) => v.weight > 0);
  const failedVariants = variants.filter((v) => v.status === "failed");
  const failedSegments = segments.filter((s) => s.status === "failed");
  const hasFailures =
    project.status !== "processing" &&
    (failedVariants.length > 0 || failedSegments.length > 0);
  const isSplitTest = activeVariants.length > 1;

  // Find best-performing segments from analytics
  const bestSegmentIds = getBestSegmentIds(analytics, variants, segments);

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
              onClick={load}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992"
                />
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
            {/* Split test indicator */}
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
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Upload Segments
            </Button>
          </Link>
          {renderedVariants.length > 0 && (
            <Link href={`/projects/${projectId}/embed`}>
              <Button>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
                Get Embed Code
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Analytics Summary ── */}
      {analytics?.summary && (
        <AnalyticsSummary summary={analytics.summary} />
      )}

      {/* ── Top Performer ── */}
      {analytics?.summary?.topPerformer && (
        <TopPerformerCard
          topPerformer={analytics.summary.topPerformer}
          variantCount={renderedVariants.length}
        />
      )}

      {/* ── Failure Banner ── */}
      {hasFailures && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  {failedSegments.length > 0 &&
                    `${failedSegments.length} segment${failedSegments.length > 1 ? "s" : ""} failed`}
                  {failedSegments.length > 0 &&
                    failedVariants.length > 0 &&
                    " · "}
                  {failedVariants.length > 0 &&
                    `${failedVariants.length} variant${failedVariants.length > 1 ? "s" : ""} failed`}
                </p>
                <p className="mt-0.5 text-xs text-red-400/70">
                  {failedSegments[0]?.error_message ||
                    failedVariants[0]?.error_message ||
                    "Reset to draft and try again"}
                </p>
              </div>
            </div>
            <RetryButton projectId={projectId} onRetry={load} />
          </CardContent>
        </Card>
      )}

      {/* ── Processing Progress ── */}
      {project.status === "processing" && (
        <ProcessingProgress projectId={projectId} onComplete={load} />
      )}

      {/* ── Segment Sections (expandable) ── */}
      <div className="space-y-3">
        <SegmentTypeSection
          type="hook"
          segments={hooks}
          bestSegmentId={bestSegmentIds.hook}
        />
        <SegmentTypeSection
          type="body"
          segments={bodies}
          bestSegmentId={bestSegmentIds.body}
        />
        <SegmentTypeSection
          type="cta"
          segments={ctas}
          bestSegmentId={bestSegmentIds.cta}
        />
      </div>

      {/* ── Variants ── */}
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
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                    />
                  </svg>
                  Preview
                </Button>
              </Link>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v) => {
              const va = analytics?.variants?.find(
                (a) => a.variant_id === v.id
              );
              return (
                <VariantCard
                  key={v.id}
                  variant={v}
                  projectId={projectId}
                  analytics={
                    va
                      ? {
                          total_views: va.total_views,
                          completion_rate: va.completion_rate,
                          complete_count: va.complete_count,
                        }
                      : undefined
                  }
                  isTopPerformer={
                    analytics?.summary?.topPerformer?.variant_id === v.id &&
                    renderedVariants.length > 1
                  }
                  onUpdate={load}
                  onExpand={() => setSelectedVariantId(v.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Analytics Dashboard ── */}
      {renderedVariants.length > 0 && (
        <AnalyticsDashboard
          projectId={projectId}
          isSplitTest={isSplitTest}
        />
      )}

      {/* ── Process Button ── */}
      {hooks.length > 0 &&
        bodies.length > 0 &&
        ctas.length > 0 &&
        project.status === "draft" && (
          <ProcessButton projectId={projectId} onProcess={load} />
        )}

      {/* ── Variant Detail Panel ── */}
      {selectedVariantId && (() => {
        const selectedVariant = variants.find((v) => v.id === selectedVariantId);
        if (!selectedVariant) return null;
        return (
          <VariantDetailPanel
            variant={selectedVariant}
            segments={segments}
            projectId={projectId}
            onClose={() => setSelectedVariantId(null)}
          />
        );
      })()}
    </div>
  );
}

// ─── Split Test Indicator ──────────────────────────────────

function SplitTestIndicator({
  isSplitTest,
  activeCount,
}: {
  isSplitTest: boolean;
  activeCount: number;
}) {
  if (isSplitTest) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Split Test Active — {activeCount} variants
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/30">
      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
      Single Video
    </span>
  );
}

// ─── Variant Card (inline, with editable name) ─────────────

function VariantCardInline({
  variant,
  projectId,
  analytics,
  onUpdate,
}: {
  variant: Variant;
  projectId: string;
  analytics?: { total_views: number; completion_rate: number } | undefined;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.custom_name || "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const vConfig =
    variantStatusConfig[variant.status] || variantStatusConfig.pending;
  const displayName = variant.custom_name || variant.variant_code;
  const isActive = variant.weight > 0;
  const isRendered = variant.status === "rendered";

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    setSaving(true);
    try {
      await fetch(
        `/api/projects/${projectId}/variants/${variant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            custom_name: trimmed || null,
          }),
        }
      );
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [name, projectId, variant.id, onUpdate]);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      await fetch(
        `/api/projects/${projectId}/variants/${variant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weight: isActive ? 0 : 1,
          }),
        }
      );
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setToggling(false);
    }
  }, [projectId, variant.id, isActive, onUpdate]);

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition ${
        isActive
          ? "border-white/10 bg-white/[0.02] hover:border-white/15"
          : "border-white/5 bg-white/[0.01] opacity-50"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Name — click to edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              disabled={saving}
              placeholder={variant.variant_code}
              className="w-full bg-transparent text-sm font-medium text-white/80 outline-none border-b border-primary/50 pb-0.5"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="group flex items-center gap-1.5 text-left"
              title="Click to rename"
            >
              <span className="text-sm font-medium text-white/80 truncate">
                {displayName}
              </span>
              <svg
                className="h-3 w-3 text-white/20 opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                />
              </svg>
            </button>
          )}
          {variant.custom_name && (
            <p className="text-[11px] font-mono text-white/20 mt-0.5">
              {variant.variant_code}
            </p>
          )}
        </div>

        <div className="ml-2 flex items-center gap-2">
          {/* Enable/disable toggle */}
          {isRendered && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="group relative flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                backgroundColor: isActive
                  ? "rgba(16, 185, 129, 0.3)"
                  : "rgba(255, 255, 255, 0.08)",
              }}
              title={isActive ? "Disable variant" : "Enable variant"}
            >
              <span
                className={`absolute h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "left-[18px] bg-emerald-400"
                    : "left-[3px] bg-white/30"
                }`}
              />
            </button>
          )}

          {/* Status badge */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vConfig.bg} ${vConfig.text}`}
          >
            {!isActive && isRendered ? "disabled" : variant.status}
          </span>
        </div>
      </div>

      {/* Performance bar */}
      {analytics && analytics.total_views > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/30">
              <span className="font-mono tabular-nums text-white/50">
                {analytics.total_views}
              </span>{" "}
              views
            </span>
            <span className="text-white/30">
              <span className="font-mono tabular-nums text-white/50">
                {analytics.completion_rate}%
              </span>{" "}
              completion
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${Math.min(analytics.completion_rate, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Retry Button ──────────────────────────────────────────

function RetryButton({
  projectId,
  onRetry,
}: {
  projectId: string;
  onRetry: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function handleRetry() {
    setLoading(true);
    try {
      await supabase
        .from("segments")
        .update({ status: "uploaded", error_message: null })
        .eq("project_id", projectId)
        .in("status", ["failed", "normalizing"]);

      await supabase.from("variants").delete().eq("project_id", projectId);
      await supabase
        .from("processing_jobs")
        .delete()
        .eq("project_id", projectId);
      await supabase
        .from("projects")
        .update({ status: "draft" })
        .eq("id", projectId);

      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to start reprocessing");
      onRetry();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={loading}
      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992"
        />
      </svg>
      {loading ? "Resetting..." : "Reset & Retry"}
    </Button>
  );
}

// ─── Process Button ────────────────────────────────────────

function ProcessButton({
  projectId,
  onProcess,
}: {
  projectId: string;
  onProcess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start processing");
      }
      onProcess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <Button onClick={handleProcess} disabled={loading} className="w-full">
          {loading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Starting processing...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
              Process All Variants
            </>
          )}
        </Button>
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          Normalizes all segments and renders every combination
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ───────────────────────────────────────────────

/**
 * Determine the best-performing segment for each type based on analytics.
 * Looks at which hook/body/cta appears in the top-performing variant.
 */
function getBestSegmentIds(
  analytics:
    | { variants: { variant_id: string; completion_rate: number }[] }
    | undefined
    | null,
  variants: Variant[],
  segments: Segment[]
): { hook: string | null; body: string | null; cta: string | null } {
  const result = {
    hook: null as string | null,
    body: null as string | null,
    cta: null as string | null,
  };

  if (!analytics?.variants || analytics.variants.length < 2) return result;

  // Find best variant by completion rate
  let bestVariantId: string | null = null;
  let bestRate = -1;
  for (const va of analytics.variants) {
    if (va.completion_rate > bestRate) {
      bestRate = va.completion_rate;
      bestVariantId = va.variant_id;
    }
  }

  if (!bestVariantId) return result;

  const bestVariant = variants.find((v) => v.id === bestVariantId);
  if (!bestVariant) return result;

  // Only mark as "best" if there are multiple segments of that type
  const hookCount = segments.filter((s) => s.type === "hook").length;
  const bodyCount = segments.filter((s) => s.type === "body").length;
  const ctaCount = segments.filter((s) => s.type === "cta").length;

  if (hookCount > 1) result.hook = bestVariant.hook_segment_id;
  if (bodyCount > 1) result.body = bestVariant.body_segment_id;
  if (ctaCount > 1) result.cta = bestVariant.cta_segment_id;

  return result;
}
