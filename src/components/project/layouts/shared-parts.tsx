/**
 * layouts/shared-parts.tsx — Reusable UI pieces shared across all layout variants
 *
 * Extracted from page.tsx to avoid duplication. Each layout imports what it needs.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VariantCard } from "@/components/project/VariantCard";
import type { ProjectLayoutProps } from "./types";

// ─── Status Badge ───────────────────────────────────────────

const statusConfig: Record<string, { bg: string; text: string; dot: string }> =
  {
    draft: {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
    },
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

export function StatusBadge({ status }: { status: string }) {
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

// ─── Split Test Indicator ───────────────────────────────────

export function SplitTestIndicator({
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

// ─── Project Header ─────────────────────────────────────────

export function ProjectHeader({
  project,
  projectId,
  renderedVariants,
  isSplitTest,
  activeVariants,
  onRefresh,
  compact = false,
}: Pick<
  ProjectLayoutProps,
  | "project"
  | "projectId"
  | "renderedVariants"
  | "isSplitTest"
  | "activeVariants"
  | "onRefresh"
> & { compact?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1
            className={`font-semibold tracking-tight text-foreground ${compact ? "text-lg" : "text-xl"}`}
          >
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
          <button
            onClick={onRefresh}
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
          <Button variant="outline" size={compact ? "sm" : "default"}>
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
            <Button size={compact ? "sm" : "default"}>
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
  );
}

// ─── Failure Banner ─────────────────────────────────────────

export function FailureBanner({
  projectId,
  failedSegments,
  failedVariants,
  onRetry,
}: {
  projectId: string;
  failedSegments: { error_message: string | null }[];
  failedVariants: { error_message: string | null }[];
  onRetry: () => void;
}) {
  return (
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
        <RetryButton projectId={projectId} onRetry={onRetry} />
      </CardContent>
    </Card>
  );
}

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

// ─── Process Button ─────────────────────────────────────────

export function ProcessButtonSection({
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

// ─── Variants Section ───────────────────────────────────────

export function VariantsSection({
  projectId,
  variants,
  renderedVariants,
  analytics,
  onRefresh,
  onSelectVariant,
}: Pick<
  ProjectLayoutProps,
  | "projectId"
  | "variants"
  | "renderedVariants"
  | "analytics"
  | "onRefresh"
  | "onSelectVariant"
>) {
  return (
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
              onUpdate={onRefresh}
              onExpand={() => onSelectVariant(v.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
