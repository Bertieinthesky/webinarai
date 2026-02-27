/**
 * projects/[projectId]/page.tsx — Project detail and management page
 *
 * PURPOSE:
 *   The central hub for a single project. Shows segment counts (hooks,
 *   bodies, CTAs), variant grid with rendering status, and action buttons
 *   for uploading segments, processing variants, previewing, and getting
 *   the embed code.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessingProgress } from "@/components/project/ProcessingProgress";
import type { Database } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  processing: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  ready: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  archived: { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-500" },
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status === "processing" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

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

  // Real-time subscription: reload when segments or variants change status
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "segments", filter: `project_id=eq.${projectId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "variants", filter: `project_id=eq.${projectId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
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
  const failedVariants = variants.filter((v) => v.status === "failed");
  const failedSegments = segments.filter((s) => s.status === "failed");
  const hasFailures = failedVariants.length > 0 || failedSegments.length > 0;

  const segmentCounts = [
    { label: "Hooks", count: hooks.length, color: "text-sky-400", bg: "bg-sky-500/10", iconBg: "bg-sky-500/15" },
    { label: "Bodies", count: bodies.length, color: "text-emerald-400", bg: "bg-emerald-500/10", iconBg: "bg-emerald-500/15" },
    { label: "CTAs", count: ctas.length, color: "text-violet-400", bg: "bg-violet-500/10", iconBg: "bg-violet-500/15" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} />
            <button
              onClick={load}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
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

      {/* Segment counts */}
      <div className="grid gap-4 sm:grid-cols-3">
        {segmentCounts.map((item) => (
          <Card key={item.label} className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                <span className={`text-lg font-semibold ${item.color}`}>{item.count}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">segments</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Retry banner — only shown when there are actual failures */}
      {hasFailures && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  {failedSegments.length > 0 && `${failedSegments.length} segment${failedSegments.length > 1 ? "s" : ""} failed`}
                  {failedSegments.length > 0 && failedVariants.length > 0 && " · "}
                  {failedVariants.length > 0 && `${failedVariants.length} variant${failedVariants.length > 1 ? "s" : ""} failed`}
                </p>
                <p className="mt-0.5 text-xs text-red-400/70">
                  {failedSegments[0]?.error_message || failedVariants[0]?.error_message || "Reset to draft and try again"}
                </p>
              </div>
            </div>
            <RetryButton projectId={projectId} />
          </CardContent>
        </Card>
      )}

      {/* Processing progress (real-time) */}
      {project.status === "processing" && (
        <ProcessingProgress projectId={projectId} onComplete={load} />
      )}

      {/* Variants (when not processing) */}
      {project.status !== "processing" && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-[15px] font-medium text-foreground">Variants</CardTitle>
            <CardDescription>
              {variants.length > 0
                ? `${renderedVariants.length} of ${variants.length} rendered`
                : "Upload segments and process to generate variants"}
            </CardDescription>
          </CardHeader>
          {variants.length > 0 && (
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {variants.map((v) => {
                  const vConfig = variantStatusConfig[v.status] || variantStatusConfig.pending;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="font-mono text-sm text-foreground/80">
                        {v.variant_code}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vConfig.bg} ${vConfig.text}`}>
                        {v.status}
                      </span>
                    </div>
                  );
                })}
              </div>
              {renderedVariants.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <Link href={`/projects/${projectId}/preview`}>
                    <Button variant="outline" size="sm">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                      </svg>
                      Preview Variants
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Process button */}
      {hooks.length > 0 &&
        bodies.length > 0 &&
        ctas.length > 0 &&
        project.status === "draft" && (
          <ProcessButton projectId={projectId} />
        )}
    </div>
  );
}

function RetryButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function handleRetry() {
    setLoading(true);
    try {
      // Reset failed segments to "uploaded" so they can be re-normalized
      await supabase
        .from("segments")
        .update({ status: "uploaded", error_message: null })
        .eq("project_id", projectId)
        .in("status", ["failed", "normalizing"]);

      // Delete failed/pending variants (will be recreated)
      await supabase
        .from("variants")
        .delete()
        .eq("project_id", projectId);

      // Delete old processing jobs
      await supabase
        .from("processing_jobs")
        .delete()
        .eq("project_id", projectId);

      // Reset project to draft
      await supabase
        .from("projects")
        .update({ status: "draft" })
        .eq("id", projectId);

      // Trigger reprocess
      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to start reprocessing");
      }

      window.location.reload();
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
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
      </svg>
      {loading ? "Resetting..." : "Reset & Retry"}
    </Button>
  );
}

function ProcessButton({ projectId }: { projectId: string }) {
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
      window.location.reload();
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
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting processing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
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
