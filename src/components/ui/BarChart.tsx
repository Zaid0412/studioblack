"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { useChartReady } from "@/hooks/useChartReady";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  bars: BarDatum[];
  /** Scale max; defaults to the largest value. Pass 100 for percents. */
  max?: number;
  /** Format the trailing value. Default: the raw number. */
  formatValue?: (v: number) => string;
  /** Any CSS color for the fill — a theme var or hex. Default: accent. */
  barColor?: string;
  emptyLabel?: string;
  className?: string;
}

/** Row height per bar (bar + gap), px. */
const ROW = 38;
/** Track/fill thickness, px. */
const BAR = 10;

/**
 * Custom bar background — a thin rounded pill track centered in the row (the
 * recharts default fills the whole category band, which is too tall). recharts
 * clones this element with the row geometry (`x`/`y`/`width`/`height`).
 */
function Track({
  x,
  y,
  width,
  height,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  return (
    <rect
      x={x}
      y={(y ?? 0) + (height ?? 0) / 2 - BAR / 2}
      width={width}
      height={BAR}
      rx={BAR / 2}
      fill="var(--bg-elevated)"
    />
  );
}

/**
 * Horizontal recharts bar chart — a label, a rounded track with a grow-in fill,
 * and the value in an aligned right column (drawn as the right axis' ticks so
 * each value lines up with its row). Hovering a row focuses that bar and dims
 * the others (band-level `activeTooltipIndex` → per-`Cell` fill-opacity) plus
 * an info tooltip. The entrance runs once — disabled after it ends (`ready`) so
 * hover re-renders don't replay it. Serves money bars (custom `formatValue`)
 * and progress bars (per-phase %, `max={100}`).
 */
export function BarChart({
  bars,
  max,
  formatValue = (v) => String(v),
  barColor = "var(--accent)",
  emptyLabel = "No data",
  className,
}: BarChartProps) {
  const [ready, markReady] = useChartReady();
  const [active, setActive] = useState<number | null>(null);
  const reduced = prefersReducedMotion();
  const values = useMemo(
    () => new Map(bars.map((b) => [b.label, formatValue(b.value)])),
    [bars, formatValue]
  );

  if (bars.length === 0) {
    return (
      <p className={cn("text-[13px] text-text-muted", className)}>
        {emptyLabel}
      </p>
    );
  }

  const renderLabelTick = ({
    y,
    payload,
  }: {
    y?: string | number;
    payload?: { value?: string };
  }) => (
    <text
      x={0}
      y={Number(y)}
      dy={4}
      textAnchor="start"
      fontSize={12}
      fill="var(--text-secondary)"
    >
      {payload?.value}
    </text>
  );

  const renderValueTick = ({
    x,
    y,
    payload,
  }: {
    x?: string | number;
    y?: string | number;
    payload?: { value?: string };
  }) => (
    <text
      x={Number(x) + 60}
      y={Number(y)}
      dy={4}
      textAnchor="end"
      fontSize={12.5}
      fontWeight={500}
      fill="var(--text-primary)"
    >
      {values.get(payload?.value ?? "")}
    </text>
  );

  return (
    <div
      className={cn("bar-chart", !ready && "pointer-events-none", className)}
      style={{ width: "100%", height: bars.length * ROW }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart
          data={bars}
          layout="vertical"
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
          onMouseMove={(state: {
            activeTooltipIndex?: number | string | null;
          }) => {
            const i = state?.activeTooltipIndex;
            setActive(i == null || i === "" ? null : Number(i));
          }}
          onMouseLeave={() => setActive(null)}
        >
          <XAxis type="number" hide domain={[0, max ?? "dataMax"]} />
          <YAxis
            yAxisId="left"
            type="category"
            dataKey="label"
            width={104}
            axisLine={false}
            tickLine={false}
            tick={renderLabelTick}
          />
          <YAxis
            yAxisId="right"
            type="category"
            dataKey="label"
            orientation="right"
            width={72}
            axisLine={false}
            tickLine={false}
            tick={renderValueTick}
          />
          <Tooltip
            cursor={false}
            content={<BarTooltip formatValue={formatValue} />}
          />
          <Bar
            yAxisId="left"
            dataKey="value"
            barSize={BAR}
            radius={[BAR / 2, BAR / 2, BAR / 2, BAR / 2]}
            background={<Track />}
            activeBar={false}
            isAnimationActive={!reduced && !ready}
            onAnimationEnd={markReady}
          >
            {bars.map((_, i) => (
              <Cell
                key={i}
                fill={barColor}
                opacity={active === null || active === i ? 1 : 0.3}
              />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

type PayloadItem = { value?: number; color?: string; payload?: BarDatum };

function BarTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: PayloadItem[];
  formatValue: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-2.5 py-1.5 text-xs shadow-md">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-sm"
          style={{ background: p.color || "var(--accent)" }}
        />
        <span className="text-text-secondary">{p.payload?.label}</span>
        <span className="ml-2 font-medium tabular-nums text-text-primary">
          {formatValue(p.value ?? 0)}
        </span>
      </span>
    </div>
  );
}
