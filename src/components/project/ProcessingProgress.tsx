"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];

interface ProcessingProgressProps {
  projectId: string;
  onComplete?: () => void;
}

export function ProcessingProgress({
  projectId,
  onComplete,
}: ProcessingProgressProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [phase, setPhase] = useState<"normalizing" | "rendering" | "complete">(
    "normalizing"
  );
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    const [segRes, varRes] = await Promise.all([
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
    if (segRes.data) setSegments(segRes.data as Segment[]);
    if (varRes.data) setVariants(varRes.data as Variant[]);
  }, [projectId, supabase]);

  // Initial load + polling fallback
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Supabase realtime for instant updates
  useEffect(() => {
    const channel = supabase
      .channel(`processing-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "segments",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setSegments((prev) =>
            prev.map((s) =>
              s.id === payload.new.id ? { ...s, ...payload.new } : s
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variants",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setVariants((prev) => [...prev, payload.new as Variant]);
          } else if (payload.eventType === "UPDATE") {
            setVariants((prev) =>
              prev.map((v) =>
                v.id === payload.new.id ? { ...v, ...payload.new } : v
              )
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.new.status === "ready") {
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase, onComplete]);

  // Compute phase and progress
  const normalizedCount = segments.filter(
    (s) => s.status === "normalized"
  ).length;
  const failedSegments = segments.filter((s) => s.status === "failed");
  const totalSegments = segments.length;
  const normalizeProgress =
    totalSegments > 0 ? (normalizedCount / totalSegments) * 100 : 0;

  const renderedCount = variants.filter((v) => v.status === "rendered").length;
  const failedVariants = variants.filter((v) => v.status === "failed");
  const totalVariants = variants.length;
  const renderProgress =
    totalVariants > 0 ? (renderedCount / totalVariants) * 100 : 0;

  // Determine current phase
  useEffect(() => {
    if (totalVariants > 0 && renderedCount === totalVariants) {
      setPhase("complete");
      onComplete?.();
    } else if (normalizedCount === totalSegments && totalSegments > 0) {
      setPhase("rendering");
    } else {
      setPhase("normalizing");
    }
  }, [normalizedCount, totalSegments, renderedCount, totalVariants, onComplete]);

  // Overall progress: normalize = 0-50%, render = 50-100%
  const overallProgress =
    phase === "complete"
      ? 100
      : phase === "rendering"
        ? 50 + renderProgress * 0.5
        : normalizeProgress * 0.5;

  const statusBadge = (
    status: string,
    _type: "segment" | "variant"
  ) => {
    const colors: Record<string, string> = {
      uploaded: "bg-zinc-700 text-zinc-400",
      normalizing: "bg-blue-500/20 text-blue-400",
      normalized: "bg-green-500/20 text-green-400",
      pending: "bg-zinc-700 text-zinc-400",
      rendering: "bg-yellow-500/20 text-yellow-400",
      rendered: "bg-green-500/20 text-green-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return (
      <Badge variant="secondary" className={colors[status] || ""}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base text-white">
            <span>Processing Pipeline</span>
            <span className="text-sm font-normal text-zinc-400">
              {Math.round(overallProgress)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={overallProgress}
            className="h-3 bg-zinc-800"
            indicatorClassName={
              phase === "complete"
                ? "bg-green-500"
                : phase === "rendering"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
            }
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span
              className={
                phase === "normalizing"
                  ? "text-blue-400 font-medium"
                  : "text-green-400"
              }
            >
              1. Normalize segments
            </span>
            <span
              className={
                phase === "rendering"
                  ? "text-yellow-400 font-medium"
                  : phase === "complete"
                    ? "text-green-400"
                    : ""
              }
            >
              2. Render variants
            </span>
            <span
              className={phase === "complete" ? "text-green-400 font-medium" : ""}
            >
              3. Ready
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Normalization progress */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm text-white">
            <span className="flex items-center gap-2">
              {phase === "normalizing" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
              Normalizing Segments
            </span>
            <span className="font-normal text-zinc-400">
              {normalizedCount}/{totalSegments}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress
            value={normalizeProgress}
            className="h-2 bg-zinc-800"
            indicatorClassName="bg-blue-500"
          />
          <div className="space-y-1.5">
            {segments.map((seg) => (
              <div
                key={seg.id}
                className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase text-zinc-500">
                    {seg.type}
                  </span>
                  <span className="text-sm text-zinc-300">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {seg.status === "normalizing" && (
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-700">
                      <div className="h-full w-full animate-pulse rounded-full bg-blue-500" />
                    </div>
                  )}
                  {statusBadge(seg.status, "segment")}
                </div>
              </div>
            ))}
          </div>
          {failedSegments.length > 0 && (
            <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-400">
              {failedSegments.length} segment(s) failed.{" "}
              {failedSegments[0]?.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Render progress */}
      {(phase === "rendering" || phase === "complete" || variants.length > 0) && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm text-white">
              <span className="flex items-center gap-2">
                {phase === "rendering" && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                  </span>
                )}
                Rendering Variants
              </span>
              <span className="font-normal text-zinc-400">
                {renderedCount}/{totalVariants}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={renderProgress}
              className="h-2 bg-zinc-800"
              indicatorClassName="bg-yellow-500"
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-1.5"
                >
                  <span className="font-mono text-sm text-zinc-300">
                    {v.variant_code}
                  </span>
                  <div className="flex items-center gap-2">
                    {v.status === "rendering" && (
                      <div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-700">
                        <div className="h-full w-full animate-pulse rounded-full bg-yellow-500" />
                      </div>
                    )}
                    {statusBadge(v.status, "variant")}
                  </div>
                </div>
              ))}
            </div>
            {failedVariants.length > 0 && (
              <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-400">
                {failedVariants.length} variant(s) failed.{" "}
                {failedVariants[0]?.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completion */}
      {phase === "complete" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
          <p className="text-sm font-medium text-green-400">
            All {totalVariants} variants rendered successfully!
          </p>
        </div>
      )}
    </div>
  );
}
