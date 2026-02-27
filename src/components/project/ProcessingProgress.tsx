"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];
type Variant = Database["public"]["Tables"]["variants"]["Row"];
type ProcessingJob = Database["public"]["Tables"]["processing_jobs"]["Row"];

interface ProcessingProgressProps {
  projectId: string;
  onComplete?: () => void;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <path
        d="M12.5 7a5.5 5.5 0 00-5.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProcessingProgress({
  projectId,
  onComplete,
}: ProcessingProgressProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [phase, setPhase] = useState<"normalizing" | "rendering" | "complete">(
    "normalizing"
  );
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    const [segRes, varRes, jobRes] = await Promise.all([
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
      supabase
        .from("processing_jobs")
        .select("*")
        .eq("project_id", projectId),
    ]);
    if (segRes.data) setSegments(segRes.data as Segment[]);
    if (varRes.data) setVariants(varRes.data as Variant[]);
    if (jobRes.data) setJobs(jobRes.data as ProcessingJob[]);
  }, [projectId, supabase]);

  // Initial load + polling fallback
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
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
          event: "*",
          schema: "public",
          table: "processing_jobs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setJobs((prev) => [...prev, payload.new as ProcessingJob]);
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === payload.new.id ? { ...j, ...payload.new } : j
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

  // Build a lookup: target_id → processing job
  const jobMap = useMemo(() => {
    const map = new Map<string, ProcessingJob>();
    for (const j of jobs) {
      map.set(j.target_id, j);
    }
    return map;
  }, [jobs]);

  // Compute phase and progress
  const normalizedCount = segments.filter(
    (s) => s.status === "normalized"
  ).length;
  const failedSegments = segments.filter((s) => s.status === "failed");
  const totalSegments = segments.length;

  // Per-segment weighted progress for smoother overall bar
  const normalizeProgress = useMemo(() => {
    if (totalSegments === 0) return 0;
    let total = 0;
    for (const seg of segments) {
      if (seg.status === "normalized") {
        total += 100;
      } else if (seg.status === "normalizing") {
        const job = jobMap.get(seg.id);
        total += job?.progress ?? 0;
      }
    }
    return total / totalSegments;
  }, [segments, totalSegments, jobMap]);

  const renderedCount = variants.filter((v) => v.status === "rendered").length;
  const failedVariants = variants.filter((v) => v.status === "failed");
  const totalVariants = variants.length;

  const renderProgress = useMemo(() => {
    if (totalVariants === 0) return 0;
    let total = 0;
    for (const v of variants) {
      if (v.status === "rendered") {
        total += 100;
      } else if (v.status === "rendering") {
        const job = jobMap.get(v.id);
        total += job?.progress ?? 0;
      }
    }
    return total / totalVariants;
  }, [variants, totalVariants, jobMap]);

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

  const isActive = phase !== "complete";

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base text-foreground">
            <span className="flex items-center gap-2">
              {isActive && <Spinner className="text-primary" />}
              Processing Pipeline
            </span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {Math.round(overallProgress)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={overallProgress}
            className="h-3 bg-muted"
            animated={isActive}
            indicatorClassName={
              phase === "complete"
                ? "bg-emerald-500"
                : phase === "rendering"
                  ? "bg-amber-500"
                  : "bg-blue-500"
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span
              className={
                phase === "normalizing"
                  ? "text-blue-400 font-medium"
                  : "text-emerald-400"
              }
            >
              1. Normalize
            </span>
            <span
              className={
                phase === "rendering"
                  ? "text-amber-400 font-medium"
                  : phase === "complete"
                    ? "text-emerald-400"
                    : ""
              }
            >
              2. Render
            </span>
            <span
              className={phase === "complete" ? "text-emerald-400 font-medium" : ""}
            >
              3. Ready
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Normalization progress */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm text-foreground">
            <span className="flex items-center gap-2">
              {phase === "normalizing" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
              Normalizing Segments
            </span>
            <span className="font-normal text-muted-foreground tabular-nums">
              {normalizedCount}/{totalSegments}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress
            value={normalizeProgress}
            className="h-2 bg-muted"
            animated={phase === "normalizing"}
            indicatorClassName="bg-blue-500"
          />
          <div className="space-y-1.5">
            {segments.map((seg) => {
              const job = jobMap.get(seg.id);
              const isProcessing = seg.status === "normalizing";
              const isDone = seg.status === "normalized";
              const isFailed = seg.status === "failed";

              return (
                <div
                  key={seg.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {seg.type}
                    </span>
                    <span className="text-sm text-foreground/80">{seg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing && (
                      <>
                        <div className="w-16 overflow-hidden">
                          <Progress
                            value={job?.progress ?? 0}
                            className="h-1.5 bg-muted"
                            animated
                            indicatorClassName="bg-blue-500"
                          />
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400 tabular-nums">
                          <Spinner className="text-blue-400" />
                          {job?.progress ?? 0}%
                        </span>
                      </>
                    )}
                    {isDone && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        done
                      </span>
                    )}
                    {isFailed && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                        failed
                      </span>
                    )}
                    {!isProcessing && !isDone && !isFailed && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {seg.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {failedSegments.length > 0 && (
            <div className="mt-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
              {failedSegments.length} segment(s) failed.{" "}
              {failedSegments[0]?.error_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Render progress */}
      {(phase === "rendering" || phase === "complete" || variants.length > 0) && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm text-foreground">
              <span className="flex items-center gap-2">
                {phase === "rendering" && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
                Rendering Variants
              </span>
              <span className="font-normal text-muted-foreground tabular-nums">
                {renderedCount}/{totalVariants}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={renderProgress}
              className="h-2 bg-muted"
              animated={phase === "rendering"}
              indicatorClassName="bg-amber-500"
            />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {variants.map((v) => {
                const job = jobMap.get(v.id);
                const isProcessing = v.status === "rendering";
                const isDone = v.status === "rendered";
                const isFailed = v.status === "failed";

                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-mono text-sm text-foreground/80">
                      {v.variant_code}
                    </span>
                    <div className="flex items-center gap-2">
                      {isProcessing && (
                        <>
                          <div className="w-12 overflow-hidden">
                            <Progress
                              value={job?.progress ?? 0}
                              className="h-1.5 bg-muted"
                              animated
                              indicatorClassName="bg-amber-500"
                            />
                          </div>
                          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 tabular-nums">
                            <Spinner className="text-amber-400" />
                            {job?.progress ?? 0}%
                          </span>
                        </>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          done
                        </span>
                      )}
                      {isFailed && (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                          failed
                        </span>
                      )}
                      {!isProcessing && !isDone && !isFailed && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {v.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {failedVariants.length > 0 && (
              <div className="mt-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
                {failedVariants.length} variant(s) failed.{" "}
                {failedVariants[0]?.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completion */}
      {phase === "complete" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-sm font-medium text-emerald-400">
            All {totalVariants} variants rendered successfully!
          </p>
        </div>
      )}
    </div>
  );
}
