import { useCallback, useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Gates chart interactivity (tooltips, hover-dim) until the entrance animation
 * has finished, so hovering a chart mid-load doesn't pop a tooltip. Wire the
 * returned `markReady` to recharts' `onAnimationEnd` for the precise moment;
 * the timeout is a fallback for when it never fires. Under reduced motion there
 * is no entrance animation, so the chart is ready immediately.
 */
export function useChartReady(fallbackMs = 1800): [boolean, () => void] {
  const [ready, setReady] = useState(() => prefersReducedMotion());
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setReady(true), fallbackMs);
    return () => clearTimeout(id);
  }, [ready, fallbackMs]);
  return [ready, markReady];
}
