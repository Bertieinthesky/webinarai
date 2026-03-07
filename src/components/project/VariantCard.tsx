/**
 * VariantCard — Rich variant card with toggle, performance bar, and expand
 *
 * Designed as a standalone component for use in project detail pages.
 * Shows: custom name, status, enable/disable toggle, mini performance bar.
 * Click to expand into VariantDetailPanel.
 */

"use client";

import { useState, useCallback } from "react";
import type { Database } from "@/lib/supabase/types";

type Variant = Database["public"]["Tables"]["variants"]["Row"];

interface VariantCardProps {
  variant: Variant;
  projectId: string;
  analytics?: {
    total_views: number;
    completion_rate: number;
    complete_count: number;
  };
  isTopPerformer?: boolean;
  onUpdate: () => void;
  onExpand: () => void;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  rendered: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  rendering: { bg: "bg-amber-500/10", text: "text-amber-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400" },
  pending: { bg: "bg-zinc-500/10", text: "text-zinc-500" },
};

export function VariantCard({
  variant,
  projectId,
  analytics,
  isTopPerformer,
  onUpdate,
  onExpand,
}: VariantCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.custom_name || "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const vConfig = statusConfig[variant.status] || statusConfig.pending;
  const displayName = variant.custom_name || variant.variant_code;
  const isActive = variant.weight > 0;
  const isRendered = variant.status === "rendered";

  const handleSaveName = useCallback(async () => {
    const trimmed = name.trim();
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_name: trimmed || null }),
      });
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [name, projectId, variant.id, onUpdate]);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setToggling(true);
      try {
        await fetch(`/api/projects/${projectId}/variants/${variant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weight: isActive ? 0 : 1 }),
        });
        onUpdate();
      } catch {
        // silently fail
      } finally {
        setToggling(false);
      }
    },
    [projectId, variant.id, isActive, onUpdate]
  );

  return (
    <div
      onClick={onExpand}
      className={`group cursor-pointer rounded-xl border px-4 py-3 transition ${
        isActive
          ? "border-white/10 bg-white/[0.02] hover:border-white/15"
          : "border-white/5 bg-white/[0.01] opacity-50 hover:opacity-70"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Name */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditing(false);
              }}
              disabled={saving}
              placeholder={variant.variant_code}
              className="w-full bg-transparent text-sm font-medium text-white/80 outline-none border-b border-primary/50 pb-0.5"
            />
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 text-left"
                title="Click to rename"
              >
                <span className="text-sm font-medium text-white/80 truncate">
                  {displayName}
                </span>
                <svg
                  className="h-3 w-3 shrink-0 text-white/15 opacity-0 transition-opacity group-hover:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                  />
                </svg>
              </button>
              {isTopPerformer && (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400/80">
                  Top
                </span>
              )}
            </div>
          )}
          {variant.custom_name && (
            <p className="text-[11px] font-mono text-white/20 mt-0.5">
              {variant.variant_code}
            </p>
          )}
        </div>

        <div className="ml-2 flex items-center gap-2">
          {/* Toggle */}
          {isRendered && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="relative flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                backgroundColor: isActive
                  ? "rgba(16, 185, 129, 0.3)"
                  : "rgba(255, 255, 255, 0.08)",
              }}
              title={isActive ? "Disable variant" : "Enable variant"}
            >
              <span
                className={`absolute h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "left-[18px] bg-emerald-400"
                    : "left-[3px] bg-white/30"
                }`}
              />
            </button>
          )}

          {/* Status */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vConfig.bg} ${vConfig.text}`}
          >
            {!isActive && isRendered ? "disabled" : variant.status}
          </span>

          {/* Expand arrow */}
          <svg
            className="h-3.5 w-3.5 text-white/15 transition-colors group-hover:text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>

      {/* Performance bar */}
      {analytics && analytics.total_views > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/30">
              <span className="font-mono tabular-nums text-white/50">
                {analytics.total_views.toLocaleString()}
              </span>{" "}
              views
            </span>
            <span className="text-white/30">
              <span className="font-mono tabular-nums text-white/50">
                {analytics.completion_rate}%
              </span>{" "}
              completion
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${Math.min(analytics.completion_rate, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
