/**
 * AnalyticsChart — Recharts area chart for views/completions over time
 *
 * Shows one line per variant, colored with chart CSS variables.
 * Dark-themed to match the app's aesthetic.
 */

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyView } from "@/hooks/use-analytics";

// Chart colors matching --chart-1 through --chart-5
const CHART_COLORS = [
  "hsl(199, 89%, 48%)", // sky
  "hsl(160, 60%, 45%)", // teal
  "hsl(30, 80%, 55%)",  // orange
  "hsl(280, 65%, 60%)", // purple
  "hsl(340, 75%, 55%)", // pink
];

interface AnalyticsChartProps {
  dailyViews: DailyView[];
  metric: "views" | "completions";
  variantCodes: string[];
}

interface ChartDataPoint {
  date: string;
  [variantCode: string]: string | number;
}

export function AnalyticsChart({
  dailyViews,
  metric,
  variantCodes,
}: AnalyticsChartProps) {
  // Transform daily views into chart data points grouped by date
  const chartData: ChartDataPoint[] = [];
  const dateMap = new Map<string, ChartDataPoint>();

  for (const dv of dailyViews) {
    const date = dv.day;
    if (!dateMap.has(date)) {
      const point: ChartDataPoint = { date };
      dateMap.set(date, point);
      chartData.push(point);
    }
    const point = dateMap.get(date)!;
    point[dv.variant_code] = metric === "views" ? dv.views : dv.completions;
  }

  // Sort by date
  chartData.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
        <span className="text-sm text-white/30">
          No data yet — views will appear here once tracking starts
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <defs>
            {variantCodes.map((code, i) => (
              <linearGradient
                key={code}
                id={`gradient-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
            tickFormatter={(date: string) => {
              const d = new Date(date);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "rgba(255,255,255,0.8)",
              fontSize: "12px",
            }}
            labelFormatter={(label) =>
              new Date(String(label)).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          {variantCodes.map((code, i) => (
            <Area
              key={code}
              type="monotone"
              dataKey={code}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              fill={`url(#gradient-${i})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: CHART_COLORS[i % CHART_COLORS.length],
                stroke: "#000",
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      {variantCodes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-4 px-2">
          {variantCodes.map((code, i) => (
            <div key={code} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
              <span className="text-xs text-white/40">{code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
