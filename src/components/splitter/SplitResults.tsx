/**
 * SplitResults.tsx — Download clips + Create Project from split results
 *
 * Shows a grid of clip cards with download buttons.
 * "Create Project" button creates a webinar.ai project from the clips.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDuration, formatFileSize } from "@/lib/utils/format";

interface Clip {
  id: string;
  clip_index: number;
  label: string;
  status: string;
  storage_key: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  start_ms: number;
  end_ms: number;
}

interface SplitResultsProps {
  splitId: string;
}

export function SplitResults({ splitId }: SplitResultsProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch split + clips
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tools/splitter/${splitId}`);
        if (!res.ok) throw new Error("Failed to load results");
        const data = await res.json();
        setClips(data.clips?.filter((c: Clip) => c.status === "ready") || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [splitId]);

  // Download a clip via presigned URL
  const handleDownload = useCallback(async (clip: Clip) => {
    try {
      // Get a presigned download URL from the API
      const res = await fetch(
        `/api/tools/splitter/${splitId}?download=${clip.id}`
      );
      if (!res.ok) throw new Error("Failed to get download URL");
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch {
      // Fallback: open storage key directly (won't work without presigned URL)
    }
  }, [splitId]);

  // Create project from clips
  const handleCreateProject = useCallback(async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/tools/splitter/${splitId}/create-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: `Split Project — ${new Date().toLocaleDateString()}`,
          clipAssignments: clips.map((clip) => ({
            clipId: clip.id,
            type: labelToType(clip.label),
            label: clip.label,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }

      const { projectId } = await res.json();
      router.push(`/projects/${projectId}/upload`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setCreating(false);
    }
  }, [clips, splitId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-white/40">Loading results...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white/80">
            Split Complete
          </h3>
          <p className="text-xs text-white/40">
            {clips.length} clips ready
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Clip grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <span className="text-sm font-medium text-white/80">
                  {clip.label}
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                  <span>{clip.duration_ms ? formatDuration(clip.duration_ms) : "--"}</span>
                  <span className="text-white/20">|</span>
                  <span>{clip.size_bytes ? formatFileSize(clip.size_bytes) : "--"}</span>
                </div>
              </div>
              <TypeBadge label={clip.label} />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/10 text-xs"
              onClick={() => handleDownload(clip)}
            >
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </Button>
          </div>
        ))}
      </div>

      {/* Create Project CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white/80">
              Ready to A/B test?
            </h4>
            <p className="mt-0.5 text-xs text-white/40">
              Create a Webinar AI project from these clips to start testing variants.
            </p>
          </div>
          <Button onClick={handleCreateProject} disabled={creating || clips.length === 0}>
            {creating ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Map a label string to a segment type. */
function labelToType(label: string): "hook" | "body" | "cta" {
  const lower = label.toLowerCase();
  if (lower.includes("hook") || lower.includes("intro")) return "hook";
  if (lower.includes("cta") || lower.includes("outro")) return "cta";
  return "body";
}

function TypeBadge({ label }: { label: string }) {
  const type = labelToType(label);
  const config = {
    hook: { bg: "bg-sky-500/10", text: "text-sky-400" },
    body: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    cta: { bg: "bg-violet-500/10", text: "text-violet-400" },
  };
  const { bg, text } = config[type];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${bg} ${text}`}>
      {type.toUpperCase()}
    </span>
  );
}
