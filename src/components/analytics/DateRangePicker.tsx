/**
 * DateRangePicker — Preset date range buttons + custom date inputs
 */

"use client";

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}

const presets = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
] as const;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function getActivePreset(
  startDate: string | null
): number | null {
  if (!startDate) return null;
  const diff = Math.round(
    (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  for (const p of presets) {
    if (p.days !== null && Math.abs(diff - p.days) <= 1) return p.days;
  }
  return -1; // custom
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const activePreset = getActivePreset(startDate);

  return (
    <div className="flex items-center gap-1.5">
      {presets.map((preset) => (
        <button
          key={preset.label}
          onClick={() =>
            onChange(preset.days ? daysAgo(preset.days) : null, endDate)
          }
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            activePreset === preset.days
              ? "bg-primary/15 text-primary"
              : "text-white/40 hover:bg-white/5 hover:text-white/60"
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
