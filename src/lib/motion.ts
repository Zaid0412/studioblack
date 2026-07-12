/** Shared motion helpers. One easing token, WAAPI wrapper, reduced-motion guard. */

/** MD standard easing — matches `--sheet-ease-out` in globals.css. */
export const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";

/** SSR-safe check for the user's reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Run a WAAPI animation on an element, no-op under reduced motion. Defaults the
 * easing to EASE_STANDARD; callers override via `options`.
 */
export function animateIn(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions = {}
): Animation | undefined {
  if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
  return el.animate(keyframes, { easing: EASE_STANDARD, ...options });
}
