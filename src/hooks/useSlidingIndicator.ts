"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

interface IndicatorStyle {
  left: number;
  width: number;
  top: number;
  height: number;
}

const HIDDEN: IndicatorStyle = { left: 0, width: 0, top: 0, height: 0 };

/**
 * Measures the active child inside `containerRef` and returns the position of
 * an absolutely-positioned indicator that can slide between items.
 *
 * The active child is located via `[data-active="true"]`. Re-measures when
 * `activeKey` changes, on container resize (ResizeObserver), and on mount
 * (layout effect, to avoid a flash). SSR-safe: reports zero size until the
 * first measure.
 *
 * Both axes are always returned, so callers can track either or both — a pill
 * behind a wrapping list needs top/height as well as left/width, an underline
 * needs only left/width. Callers pick the keys they want.
 *
 * @param containerRef  the `position: relative` container wrapping the items
 * @param activeKey     value that changes when the active item changes
 */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  activeKey: string | number | null | undefined
) {
  const [style, setStyle] = useState<IndicatorStyle>(HIDDEN);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    const next: IndicatorStyle = active
      ? {
          left: active.offsetLeft,
          width: active.offsetWidth,
          top: active.offsetTop,
          height: active.offsetHeight,
        }
      : HIDDEN;

    // Bail out when nothing moved. ResizeObserver fires once immediately on
    // observe(), and a resize/font-load re-measures every mounted strip — without
    // this guard each of those allocates a new object and forces a re-render with
    // identical numbers.
    setStyle((prev) =>
      prev.left === next.left &&
      prev.width === next.width &&
      prev.top === next.top &&
      prev.height === next.height
        ? prev
        : next
    );
  }, [containerRef]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    measure();
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, activeKey]);

  return style;
}
