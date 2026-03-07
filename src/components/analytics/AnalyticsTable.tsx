/**
 * AnalyticsTable — Sortable variant analytics table
 *
 * Shows per-variant metrics with progress funnel visualization.
 */

"use client";

import { useState } from "react";
import type { VariantAnalytics } from "@/hooks/use-analytics";

interface AnalyticsTableProps {
  variants: VariantAnalytics[];
}

type SortKey =
  | "total_views"
  | "unique_viewers"
  | "completion_rate"
  | "progress_25_count"
  | "progress_50_count"
  | "progress_75_count"
  | "complete_count";

const columns: { key: SortKey; label: string; short: string }[] = [
  { key: "total_views", label: "Views", short: "Views" },
  { key: "unique_viewers", label: "Unique", short: "Uniq" },
  { key: "progress_25_count", label: "25%", short: "25%" },
  { key: "progress_50_count", label: "50%", short: "50%" },
  { key: "progress_75_count", label: "75%", short: "75%" },
  { key: "complete_count", label: "Complete", short: "Done" },
  { key: "completion_rate", label: "Rate", short: "Rate" },
];

export function AnalyticsTable({ variants }: AnalyticsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total_views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...variants].sort((a, b) => {
    const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortDir === "desc" ? -diff : diff;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Find max values for relative bars
  const maxViews = Math.max(...variants.map((v) => v.total_views || 0), 1);
  const bestRate = Math.max(
    ...variants.map((v) => v.completion_rate || 0),
    0
  );

  if (variants.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-white/30">
                Variant
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/30 transition-colors hover:text-white/50"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.short}
                    {sortKey === col.key && (
                      <svg
                        className={`h-3 w-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const isBest =
                variants.length > 1 && v.completion_rate === bestRate && bestRate > 0;
              return (
                <tr
                  key={v.variant_id}
                  className="border-b border-white/[0.03] last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/70">
                        {v.custom_name || v.variant_code}
                      </span>
                      {isBest && (
                        <svg
                          className="h-3.5 w-3.5 text-amber-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                    </div>
                    {/* Mini views bar */}
                    <div className="mt-1.5 h-1 w-full max-w-[80px] rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/40"
                        style={{
                          width: `${((v.total_views || 0) / maxViews) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-3 text-right font-mono text-xs tabular-nums text-white/50"
                    >
                      {col.key === "completion_rate"
                        ? `${v[col.key] || 0}%`
                        : (v[col.key] || 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
