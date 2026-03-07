/**
 * CombinationGrid — Shows all possible variant combinations with deselection
 *
 * Each row shows hook + body + CTA label with a checkbox.
 * Users can uncheck combos to exclude them from processing.
 */

"use client";

import { useMemo } from "react";
import type { Database } from "@/lib/supabase/types";

type Segment = Database["public"]["Tables"]["segments"]["Row"];

interface CombinationGridProps {
  hooks: Segment[];
  bodies: Segment[];
  ctas: Segment[];
  excluded: Set<string>;
  onToggle: (comboKey: string) => void;
}

function comboKey(hookId: string, bodyId: string, ctaId: string): string {
  return `${hookId}|${bodyId}|${ctaId}`;
}

export function CombinationGrid({
  hooks,
  bodies,
  ctas,
  excluded,
  onToggle,
}: CombinationGridProps) {
  const combinations = useMemo(() => {
    const combos: {
      key: string;
      hookLabel: string;
      bodyLabel: string;
      ctaLabel: string;
    }[] = [];
    for (const h of hooks) {
      for (const b of bodies) {
        for (const c of ctas) {
          combos.push({
            key: comboKey(h.id, b.id, c.id),
            hookLabel: h.label,
            bodyLabel: b.label,
            ctaLabel: c.label,
          });
        }
      }
    }
    return combos;
  }, [hooks, bodies, ctas]);

  const activeCount = combinations.filter((c) => !excluded.has(c.key)).length;

  if (combinations.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div>
          <h3 className="text-sm font-medium text-white/80">
            Variant Combinations
          </h3>
          <p className="text-xs text-white/30 mt-0.5">
            {activeCount} of {combinations.length} selected
          </p>
        </div>
        <button
          onClick={() => {
            // Toggle all: if any excluded, select all; if all selected, deselect all
            if (excluded.size > 0) {
              // Clear all exclusions
              excluded.forEach((key) => onToggle(key));
            } else {
              // Exclude all
              combinations.forEach((c) => onToggle(c.key));
            }
          }}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          {excluded.size > 0 ? "Select All" : "Deselect All"}
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {combinations.map((combo) => {
          const isExcluded = excluded.has(combo.key);
          return (
            <label
              key={combo.key}
              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 ${
                isExcluded ? "opacity-40" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={!isExcluded}
                onChange={() => onToggle(combo.key)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-primary"
              />
              <span className="flex items-center gap-1.5 text-xs text-white/60 min-w-0">
                <span className="text-sky-400 truncate">{combo.hookLabel}</span>
                <span className="text-white/15">+</span>
                <span className="text-emerald-400 truncate">{combo.bodyLabel}</span>
                <span className="text-white/15">+</span>
                <span className="text-violet-400 truncate">{combo.ctaLabel}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export { comboKey };
