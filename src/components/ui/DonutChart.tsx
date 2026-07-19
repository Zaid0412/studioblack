import { cn } from "@/lib/utils";

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
  centerValue?: string;
  centerLabel?: string;
  /** Render the label/value legend beside the ring. */
  legend?: boolean;
  className?: string;
}

/**
 * Library-free donut chart — a CSS `conic-gradient` ring with a punched-out
 * center. Theme-aware via CSS color vars; no chart dependency, no animation
 * (so nothing to gate on `prefers-reduced-motion`). The center hole matches
 * `--bg-secondary`, the chart-card background these live on.
 */
export function DonutChart({
  segments,
  size = 160,
  thickness = 22,
  centerValue,
  centerLabel,
  legend = true,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let acc = 0;
  const stops =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((seg) => {
            const start = (acc / total) * 360;
            acc += seg.value;
            const end = (acc / total) * 360;
            return `${seg.color} ${start}deg ${end}deg`;
          })
          .join(", ")
      : "var(--border) 0deg 360deg";

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        role="img"
        aria-label={
          total > 0
            ? segments.map((s) => `${s.label}: ${s.value}`).join(", ")
            : "No data"
        }
        className="relative shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops})`,
        }}
      >
        <div
          className="absolute flex flex-col items-center justify-center rounded-full bg-bg-secondary"
          style={{ inset: thickness }}
        >
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
      </div>

      {legend && (
        <ul className="flex min-w-0 flex-col gap-2">
          {segments.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2 text-[13px]">
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
