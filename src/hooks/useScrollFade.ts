import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollFade {
  /** Content is clipped above the viewport (scrolled down). */
  top: boolean;
  /** Content is clipped below the viewport (can scroll down). */
  bottom: boolean;
}

/** Build the edge-fade mask — only the clipped edge(s) fade out. */
function fadeMask(
  top: boolean,
  bottom: boolean,
  size: number
): string | undefined {
  if (!top && !bottom) return undefined;
  const start = top ? `transparent 0, #000 ${size}px` : "#000 0";
  const end = bottom
    ? `#000 calc(100% - ${size}px), transparent 100%`
    : "#000 100%";
  return `linear-gradient(to bottom, ${start}, ${end})`;
}

/**
 * Tracks whether a scroll container has content hidden above/below its
 * viewport and returns a `maskImage` that fades the clipped edge(s). Recomputes
 * on scroll, on resize, and when the content size changes (ResizeObserver on
 * the element). `fadeSize` is the fade height in px.
 */
export function useScrollFade<T extends HTMLElement>(fadeSize = 22) {
  const ref = useRef<T>(null);
  const [fade, setFade] = useState<ScrollFade>({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const maskImage = fadeMask(fade.top, fade.bottom, fadeSize);
  return { ref, maskImage } as const;
}
