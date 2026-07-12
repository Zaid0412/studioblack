import { cn } from "@/lib/utils";

/**
 * Absolutely-positioned indicator that slides between tabs. Pair with
 * `useSlidingIndicator`, which measures the active item and returns the
 * position to spread into `style`. Owns the transition and reduced-motion
 * contract; callers supply only the look (thickness/colour/shape) via
 * `className` — e.g. `"bottom-0 h-0.5 bg-accent"` for an underline or
 * `"inset-y-0 rounded-md bg-bg-elevated"` for a pill.
 *
 * The container must be `position: relative` (and, if it scrolls horizontally,
 * must itself be the scroll element so the indicator tracks on scroll).
 */
export function SlidingIndicator({
  style,
  className,
}: {
  style: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute transition-[left,width,top,height] duration-300 ease-out motion-reduce:transition-none",
        className
      )}
      style={style}
    />
  );
}
