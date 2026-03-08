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
import { LayoutSwitcher } from "@/components/project/layouts/LayoutSwitcher";
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
    <LayoutSwitcher
      project={project}
      segments={segments}
      variants={variants}
      analytics={analytics}
      projectId={projectId}
      hooks={hooks}
      bodies={bodies}
      ctas={ctas}
      renderedVariants={renderedVariants}
      activeVariants={activeVariants}
      failedSegments={failedSegments}
      failedVariants={failedVariants}
      isSplitTest={isSplitTest}
      hasFailures={hasFailures}
      bestSegmentIds={bestSegmentIds}
      selectedVariantId={selectedVariantId}
      onRefresh={load}
      onSelectVariant={setSelectedVariantId}
    />
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
