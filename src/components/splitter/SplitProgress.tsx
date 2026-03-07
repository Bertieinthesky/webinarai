/**
 * SplitProgress.tsx — Polls split status and shows per-clip progress
 *
 * Polls GET /api/tools/splitter/[splitId] every 2 seconds.
 * Transitions to results when status === "completed".
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";

interface Clip {
  id: string;
  clip_index: number;
  label: string;
  status: string;
  start_ms: number;
  end_ms: number;
}

interface SplitProgressProps {
  splitId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function SplitProgress({ splitId, onComplete, onError }: SplitProgressProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [splitStatus, setSplitStatus] = useState("splitting");

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/tools/splitter/${splitId}`);
      if (!res.ok) return;

      const data = await res.json();
      setClips(data.clips || []);
      setSplitStatus(data.split?.status || "splitting");

      if (data.split?.status === "completed") {
        onComplete();
      } else if (data.split?.status === "failed") {
        onError(data.split?.error_message || "Split failed");
      }
    } catch {
      // Silently retry on network errors
    }
  }, [splitId, onComplete, onError]);

  useEffect(() => {
    poll(); // Initial fetch
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const progressPct = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-white/10 bg-white/[0.02] px-8 py-12">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium text-white/70">
          Splitting video...
        </span>
      </div>

      <div className="w-full max-w-md">
        <Progress value={progressPct} className="h-2" />
        <p className="mt-2 text-center text-xs text-white/40">
          {readyCount} / {totalCount} clips ready
        </p>
      </div>

      {/* Per-clip status */}
      {clips.length > 0 && (
        <div className="w-full max-w-md space-y-1.5">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
            >
              <StatusDot status={clip.status} />
              <span className="text-xs text-white/60">{clip.label}</span>
              <span className="ml-auto text-[11px] text-white/30">
                {clip.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready"
      ? "bg-emerald-400"
      : status === "failed"
        ? "bg-red-400"
        : "bg-amber-400 animate-pulse";

  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}
