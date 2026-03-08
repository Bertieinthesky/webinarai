/**
 * SegmentActionsBar — Upload + Reprocess management buttons
 *
 * Compact action bar positioned near segment sections. Provides:
 *   - Upload Segments: navigates to upload page to add more hooks/bodies/CTAs
 *   - Reprocess Variants: re-runs the full processing pipeline
 *
 * Styled as secondary/management controls — not a primary CTA.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SegmentActionsBarProps {
  projectId: string;
  canReprocess: boolean;
  isProcessing: boolean;
  onReprocess: () => void;
}

export function SegmentActionsBar({
  projectId,
  canReprocess,
  isProcessing,
  onReprocess,
}: SegmentActionsBarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReprocess() {
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
      onReprocess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
      <Link href={`/projects/${projectId}/upload`}>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload Segments
        </Button>
      </Link>

      {canReprocess && !isProcessing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReprocess}
          disabled={loading}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.992" />
          </svg>
          {loading ? "Starting..." : "Reprocess Variants"}
        </Button>
      )}

      {isProcessing && (
        <span className="flex items-center gap-1.5 text-xs text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Processing...
        </span>
      )}

      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
