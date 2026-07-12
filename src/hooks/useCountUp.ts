"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Tweens a displayed integer toward `target` (from 0 on mount, from the last
 * shown value on later changes) with an ease-out curve. No-ops to the exact
 * value under reduced motion, and skips when the value hasn't changed so a
 * background refresh with the same number doesn't re-animate.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // Reduced motion: snap to the value (via rAF so it isn't a synchronous
    // setState inside the effect).
    if (prefersReducedMotion()) {
      fromRef.current = target;
      const id = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(id);
    }

    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = Math.round(from + (target - from) * eased);
      fromRef.current = current;
      setDisplay(current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
