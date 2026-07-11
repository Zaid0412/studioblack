"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

type Orientation = "horizontal" | "vertical";

interface IndicatorStyle {
  left: number;
  width: number;
  top: number;
  height: number;
}

const HIDDEN: IndicatorStyle = { left: 0, width: 0, top: 0, height: 0 };

/**
 * Measures the active child inside `containerRef` and returns an inline style
 * for an absolutely-positioned indicator that can slide between items.
 *
 * The active child is located via `[data-active="true"]` or `[data-state="active"]`
 * (the latter lets it drive Radix `Tabs`, whose triggers carry `data-state`).
 * Re-measures on active key change, on container resize (ResizeObserver), on any
 * `data-active`/`data-state` attribute change within the container
 * (MutationObserver — needed when the container doesn't own the active value, as
 * with Radix), and on mount (layout effect to avoid a flash). SSR-safe: renders
 * at zero size until the first measure.
 *
 * @param containerRef  the `position: relative` container wrapping the items
 * @param activeKey     value that changes when the active item changes
 * @param orientation   `horizontal` slides left/width, `vertical` slides top/height
 */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  activeKey: string | number | null | undefined,
  orientation: Orientation = "horizontal"
) {
  const [style, setStyle] = useState<IndicatorStyle>(HIDDEN);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      '[data-active="true"],[data-state="active"]'
    );
    if (!active) {
      setStyle(HIDDEN);
      return;
    }
    setStyle({
      left: active.offsetLeft,
      width: active.offsetWidth,
      top: active.offsetTop,
      height: active.offsetHeight,
    });
  }, [containerRef]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    measure();
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active", "data-state"],
    });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, activeKey]);

  // Both axes are always returned (a superset) so an indicator can track the
  // active item on either or both — e.g. a pill behind a wrapping Radix
  // `TabsList` needs top/height as well as left/width. `orientation` only
  // documents the primary slide direction.
  return orientation === "vertical"
    ? {
        top: style.top,
        height: style.height,
        left: style.left,
        width: style.width,
      }
    : {
        left: style.left,
        width: style.width,
        top: style.top,
        height: style.height,
      };
}
