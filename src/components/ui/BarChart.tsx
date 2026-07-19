import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  bars: BarDatum[];
  /** Scale max; defaults to the largest value (min 1). Pass 100 for percents. */
  max?: number;
  /** Format the trailing value. Default: the raw number. */
  formatValue?: (v: number) => string;
  /** Any CSS color for the fill — a theme var or hex. Default: accent. */
  barColor?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Library-free horizontal bar chart — flex rows with a percentage-width fill.
 * Serves both money bars (cost-by-division, custom `formatValue`) and progress
 * bars (per-phase %, `max={100}`). Theme-aware, no dependency, no animation.
 */
export function BarChart({
  bars,
  max,
  formatValue = (v) => String(v),
  barColor = "var(--accent)",
  emptyLabel = "No data",
  className,
}: BarChartProps) {
  if (bars.length === 0) {
    return (
      <p className={cn("text-[13px] text-text-muted", className)}>
        {emptyLabel}
      </p>
    );
  }

  const scale = max ?? Math.max(...bars.map((b) => b.value), 1);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {bars.map((b) => {
        const pct = scale > 0 ? Math.min(100, (b.value / scale) * 100) : 0;
        return (
          <li key={b.label} className="flex items-center gap-3 text-[13px]">
            <span className="w-28 shrink-0 truncate text-text-secondary">
              {b.label}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  minWidth: b.value > 0 ? 4 : 0,
                  background: barColor,
                }}
              />
            </span>
            <span className="w-20 shrink-0 text-right font-medium tabular-nums text-text-primary">
              {formatValue(b.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
