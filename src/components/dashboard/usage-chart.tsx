"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageSeriesDto } from "@/lib/types";
import { kwh } from "@/lib/format";

export interface ChartPoint {
  /** Axis label (local time). */
  label: string;
  /** Bucket start, epoch ms. */
  time: number;
  /** Sum across devices for this bucket, or null when no device reported. */
  total: number | null;
}

/**
 * Flatten per-device series into per-bucket totals.
 *
 * Buckets are keyed by the timestamps the usage service emits, so devices with
 * different spans align correctly. A bucket where no device reported a reading
 * is kept as `total: null` — the chart draws a gap instead of a fake zero.
 * Falls back to index alignment only if a payload carries no timestamps.
 */
export function seriesToChart(series: UsageSeriesDto): ChartPoint[] {
  const deviceSeries = series.devices ?? [];
  if (!deviceSeries.length) return [];

  const hourly = series.interval !== "day";
  const fmtLabel = (t: number) => {
    const d = new Date(t);
    return hourly
      ? d.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const hasTimes = deviceSeries.some((d) => (d.points ?? []).some((p) => p.time));

  if (!hasTimes) {
    // Legacy/positional fallback: align by index from the end.
    const length = Math.max(...deviceSeries.map((d) => d.points?.length ?? 0), 0);
    const points: ChartPoint[] = [];
    for (let i = 0; i < length; i++) {
      const total = deviceSeries.reduce(
        (sum, d) => sum + (d.points?.[i]?.energyConsumed ?? 0),
        0,
      );
      points.push({ label: `#${i + 1}`, time: 0, total: Math.round(total * 100) / 100 });
    }
    return points;
  }

  // Union of bucket timestamps → summed total.
  const buckets = new Map<number, number>();
  for (const d of deviceSeries) {
    for (const p of d.points ?? []) {
      if (!p.time) continue;
      const t = Date.parse(p.time);
      if (!Number.isFinite(t)) continue;
      buckets.set(t, (buckets.get(t) ?? 0) + (p.energyConsumed ?? 0));
    }
  }

  const times = [...buckets.keys()].sort((a, b) => a - b);
  if (!times.length) return [];

  // Fill the whole min→max grid at the bucket step so empty buckets render
  // as visible gaps (total: null) rather than being silently skipped — a
  // category axis would otherwise draw a straight line across the hole.
  const step = hourly ? 3_600_000 : 86_400_000;
  const points: ChartPoint[] = [];
  for (let t = times[0]; t <= times[times.length - 1]; t += step) {
    const value = buckets.get(t);
    points.push({
      label: fmtLabel(t),
      time: t,
      total: value === undefined ? null : Math.round(value * 100) / 100,
    });
  }
  return points;
}

/** True when the series contains at least one timestamped bucket. */
export function hasGaps(data: ChartPoint[]): boolean {
  return data.some((p) => p.total === null);
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
  threshold: number;
}

function ChartTooltip({ active, payload, threshold }: TooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const point = payload[0].payload as ChartPoint;
  if (point.total === null) return null;
  const over = point.total > threshold;
  return (
    <div className="panel-raised min-w-[132px] px-3 py-2 text-[12px]">
      <div className="text-[10.5px] font-medium text-text-muted">{point.label}</div>
      <div
        className={
          over
            ? "mt-1 text-[15px] font-semibold tabular text-critical-text"
            : "mt-1 text-[15px] font-semibold tabular text-text"
        }
      >
        {kwh(point.total, 2)} <span className="text-[11px] font-normal text-text-muted">kWh</span>
      </div>
      {over && (
        <div className="mt-0.5 text-[10.5px] font-medium text-critical-text">Over threshold</div>
      )}
    </div>
  );
}

export function UsageChart({
  data,
  threshold,
  compact = false,
}: {
  data: ChartPoint[];
  threshold: number;
  compact?: boolean;
}) {
  // Show every nth label to keep the axis readable on dense hourly series
  const interval = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div className={compact ? "h-52 w-full" : "h-72 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.26} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            interval={interval - 1}
            tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-plex-sans)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-plex-mono)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickMargin={6}
          />
          <Tooltip
            content={<ChartTooltip threshold={threshold} />}
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          />
          {threshold > 0 && (
            <ReferenceLine
              y={threshold}
              stroke="var(--warning)"
              strokeDasharray="6 4"
              strokeWidth={1.25}
              label={{
                value: `Limit ${kwh(threshold, 2)} kWh`,
                position: "insideTopLeft",
                fill: "var(--warning-text)",
                fontSize: 10,
                fontFamily: "var(--font-plex-sans)",
                offset: 8,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#usageFill)"
            dot={false}
            connectNulls={false}
            activeDot={{ r: 3.5, fill: "var(--accent)", stroke: "var(--surface-0)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
