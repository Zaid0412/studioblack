"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { useChartReady } from "@/hooks/useChartReady";

export interface DonutSegment {
  label: string;
  value: number;
  /** Any CSS color — a theme var like `var(--success)` or a hex. */
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Ring outer diameter, px. */
  size?: number;
  /** Ring thickness, px. */
  thickness?: number;
  /** Gap between segments, degrees. */
  gap?: number;
  centerValue?: string;
  centerLabel?: string;
  /** Render the label/value legend beside the ring. */
  legend?: boolean;
  className?: string;
}

/**
 * Recharts donut with a sweep-in entrance and a label/value legend beside the
 * ring. Hovering a segment focuses it and dims the others (recharts hover
 * state → per-`Cell` fill-opacity) and shows an info tooltip. The entrance
 * animation runs once — it's disabled after it ends (`ready`) so hover
 * re-renders don't replay it; hover is also gated until then via
 * `pointer-events`.
 */
export function DonutChart({
  segments,
  size = 150,
  thickness = 18,
  gap = 2,
  centerValue,
  centerLabel,
  legend = true,
  className,
}: DonutChartProps) {
  const [ready, markReady] = useChartReady();
  const [active, setActive] = useState<number | null>(null);
  const reduced = prefersReducedMotion();
  const outer = size / 2 - 6;
  const inner = outer - thickness;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        className={cn(
          "donut-chart relative shrink-0",
          !ready && "pointer-events-none"
        )}
        style={{ width: size, height: size }}
      >
        <PieChart width={size} height={size}>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            paddingAngle={gap}
            cornerRadius={6}
            stroke="none"
            isAnimationActive={!reduced && !ready}
            onAnimationEnd={markReady}
            onMouseEnter={(_: unknown, i: number) => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            {segments.map((s, i) => (
              <Cell
                key={i}
                fill={s.color}
                fillOpacity={active === null || active === i ? 1 : 0.35}
                className="[transition:fill-opacity_200ms_ease-out] motion-reduce:transition-none"
              />
            ))}
          </Pie>
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            content={<DonutTooltip total={total} />}
          />
        </PieChart>
        {(centerValue != null || centerLabel != null) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue != null && (
              <span className="text-2xl font-semibold leading-none text-text-primary">
                {centerValue}
              </span>
            )}
            {centerLabel != null && (
              <span className="mt-1 text-[11px] font-medium text-text-muted">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {legend && (
        <ul className="flex min-w-0 flex-col gap-2">
          {segments.map((seg, i) => (
            <li
              key={seg.label}
              className="flex items-center gap-2 text-[13px] transition-opacity"
              style={{ opacity: active === null || active === i ? 1 : 0.4 }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="truncate text-text-secondary">{seg.label}</span>
              <span className="ml-auto pl-2 font-medium tabular-nums text-text-primary">
                {seg.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload?: DonutSegment }[];
  total: number;
}) {
  const seg = active ? payload?.[0]?.payload : undefined;
  if (!seg) return null;
  const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary px-2.5 py-1.5 text-xs shadow-md">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-sm"
          style={{ background: seg.color }}
        />
        <span className="text-text-secondary">{seg.label}</span>
        <span className="ml-2 font-medium tabular-nums text-text-primary">
          {seg.value} · {pct}%
        </span>
      </span>
    </div>
  );
}
