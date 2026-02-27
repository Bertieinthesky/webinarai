/**
 * projects/[projectId]/upload/page.tsx — Segment upload page
 *
 * PURPOSE:
 *   Three-column layout where users upload video segments for each type:
 *   hooks, bodies, and CTAs. Shows a real-time count of how many variant
 *   combinations will be generated (hooks x bodies x CTAs).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SegmentUploader } from "@/components/upload/SegmentUploader";
import { Button } from "@/components/ui/button";
import type { Database, SegmentType } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];

export default function UploadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [segments, setSegments] = useState<Segment[]>([]);
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
  const totalCombinations = Math.max(hooks.length, 0) * Math.max(bodies.length, 0) * Math.max(ctas.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Upload Segments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your video segments to create test combinations
          </p>
        </div>
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Project
          </Button>
        </Link>
      </div>

      {totalCombinations > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-3.5">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold text-foreground">{totalCombinations}</span>{" "}
            variant{totalCombinations !== 1 ? "s" : ""} will be generated from{" "}
            <span className="font-medium text-sky-400">{hooks.length} hook{hooks.length !== 1 ? "s" : ""}</span>
            {" × "}
            <span className="font-medium text-emerald-400">{bodies.length} bod{bodies.length !== 1 ? "ies" : "y"}</span>
            {" × "}
            <span className="font-medium text-violet-400">{ctas.length} CTA{ctas.length !== 1 ? "s" : ""}</span>
          </p>
        </div>
      )}

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
    </div>
  );
}
