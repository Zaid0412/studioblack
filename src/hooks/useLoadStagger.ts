import { useLayoutEffect, useRef } from "react";

const STEP_MS = 110;
const MAX_STEPS = 11;

/**
 * Assigns a cascading `--an-delay` to each direct child of the returned
 * container (`index * stepMs`, capped at 11 steps) whenever `signature`
 * changes. It does not animate anything itself — children carry `.an-rise`,
 * which reads `--an-delay`. For one-time page assembly (dashboard blocks,
 * workflow stepper). `stepMs` tunes the cadence (default 110ms).
 */
export function useLoadStagger<T extends HTMLElement = HTMLElement>(
  signature: string,
  stepMs = STEP_MS
) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    Array.from(el.children).forEach((child, i) => {
      (child as HTMLElement).style.setProperty(
        "--an-delay",
        `${Math.min(i, MAX_STEPS) * stepMs}ms`
      );
    });
  }, [signature, stepMs]);

  return ref;
}
