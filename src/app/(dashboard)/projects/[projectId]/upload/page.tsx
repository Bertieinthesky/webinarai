/**
 * projects/[projectId]/upload/page.tsx — Segment upload page
 *
 * Three-column layout for uploading video segments (hooks, bodies, CTAs).
 * Shows variant combination count, combination grid with deselection,
 * and a "Start Processing" button when ready.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SegmentUploader } from "@/components/upload/SegmentUploader";
import { CombinationGrid, comboKey } from "@/components/upload/CombinationGrid";
import { Button } from "@/components/ui/button";
import type { Database, SegmentType } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];

export default function UploadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const supabase = createClient();

  const loadSegments = useCallback(async () => {
    const { data } = await supabase
      .from("segments")
      .select("*")
      .eq("project_id", projectId)
      .order("type")
      .order("sort_order");
    setSegments((data as Segment[]) || []);
  }, [projectId, supabase]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const segmentsByType = (type: SegmentType) =>
    segments.filter((s) => s.type === type);

  const hooks = segmentsByType("hook");
  const bodies = segmentsByType("body");
  const ctas = segmentsByType("cta");
  const totalCombinations =
    Math.max(hooks.length, 0) *
    Math.max(bodies.length, 0) *
    Math.max(ctas.length, 0);
  const activeCombinations = totalCombinations - excluded.size;
  const canProcess =
    hooks.length > 0 &&
    bodies.length > 0 &&
    ctas.length > 0 &&
    activeCombinations > 0;

  const handleToggleCombo = useCallback((key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    setProcessing(true);
    setProcessError(null);

    try {
      // Build excluded combinations list
      const excludedCombinations: string[] = [];
      for (const h of hooks) {
        for (const b of bodies) {
          for (const c of ctas) {
            const key = comboKey(h.id, b.id, c.id);
            if (excluded.has(key)) {
              // Build the variant code format the process API expects
              const hookIdx = hooks.indexOf(h) + 1;
              const bodyIdx = bodies.indexOf(b) + 1;
              const ctaIdx = ctas.indexOf(c) + 1;
              excludedCombinations.push(`h${hookIdx}-b${bodyIdx}-c${ctaIdx}`);
            }
          }
        }
      }

      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludedCombinations:
            excludedCombinations.length > 0 ? excludedCombinations : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start processing");
      }

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setProcessing(false);
    }
  }, [hooks, bodies, ctas, excluded, projectId, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Upload Segments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your video segments to create test combinations
          </p>
        </div>
        <Link href={`/projects/${projectId}`}>
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
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Project
          </Button>
        </Link>
      </div>

      {/* Variant count */}
      {totalCombinations > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-3.5">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold text-foreground">
              {activeCombinations}
            </span>{" "}
            variant{activeCombinations !== 1 ? "s" : ""} will be generated from{" "}
            <span className="font-medium text-sky-400">
              {hooks.length} hook{hooks.length !== 1 ? "s" : ""}
            </span>
            {" × "}
            <span className="font-medium text-emerald-400">
              {bodies.length} bod{bodies.length !== 1 ? "ies" : "y"}
            </span>
            {" × "}
            <span className="font-medium text-violet-400">
              {ctas.length} CTA{ctas.length !== 1 ? "s" : ""}
            </span>
            {excluded.size > 0 && (
              <span className="text-white/30">
                {" "}
                ({excluded.size} excluded)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Segment uploaders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SegmentUploader
          projectId={projectId}
          type="hook"
          segments={segmentsByType("hook")}
          onUploadComplete={loadSegments}
        />
        <SegmentUploader
          projectId={projectId}
          type="body"
          segments={segmentsByType("body")}
          onUploadComplete={loadSegments}
        />
        <SegmentUploader
          projectId={projectId}
          type="cta"
          segments={segmentsByType("cta")}
          onUploadComplete={loadSegments}
        />
      </div>

      {/* Combination grid */}
      {totalCombinations > 1 && (
        <CombinationGrid
          hooks={hooks}
          bodies={bodies}
          ctas={ctas}
          excluded={excluded}
          onToggle={handleToggleCombo}
        />
      )}

      {/* Start Processing button */}
      {canProcess && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          {processError && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              {processError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white/80">
                Ready to process?
              </h4>
              <p className="mt-0.5 text-xs text-white/40">
                {activeCombinations} variant
                {activeCombinations !== 1 ? "s" : ""} will be normalized and
                rendered.
              </p>
            </div>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? (
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
                  Starting...
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
                  Start Processing
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
