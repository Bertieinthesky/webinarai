/**
 * MetricCard — Compact stat card with value, label, and optional trend
 */

"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  active?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  active,
  onClick,
}: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? "border-primary/30 bg-primary/5"
          : "border-white/10 bg-white/[0.02] hover:border-white/15"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white/90 font-mono">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </button>
  );
}
