import { useState, useEffect } from "react";

/**
 * Manages open/close with a slide animation.
 * Returns: { shouldRender, stage } — render while closing, stage = "in" | "out" | null
 */
export function useSlide(open: boolean, durationMs = 200) {
  // "closing" stays true during the exit animation, then flips to false
  const [closing, setClosing] = useState(false);
  const [stage, setStage] = useState<"in" | "out" | null>(open ? "in" : null);

  // Render when open OR during exit animation
  const shouldRender = open || closing;

  useEffect(() => {
    let cancelled = false;
    if (open) {
      // Double-rAF so the initial offscreen position paints before we animate in
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setClosing(false);
          setStage("in");
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    } else {
      // Start exit animation — timeout starts inside rAF to avoid race
      let timer: ReturnType<typeof setTimeout>;
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setStage("out");
        setClosing(true);
        timer = setTimeout(() => {
          if (cancelled) return;
          setClosing(false);
          setStage(null);
        }, durationMs);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [open, durationMs]);

  return { shouldRender, stage };
}
