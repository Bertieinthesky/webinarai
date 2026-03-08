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
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/use-analytics";
import { LayoutSwitcher } from "@/components/project/layouts/LayoutSwitcher";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

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
