import { useLayoutEffect, useRef } from "react";
import { animateIn } from "@/lib/motion";

// The per-item delay (below) flatlines at index 8, so items past this cap add
// animation cost with no visual benefit. Bounds the batch on large lists (e.g.
// a BOQ with hundreds of rows across collapsed sections) while still covering
// any paginated page in full.
const MAX_REVEAL_ITEMS = 32;

/**
 * Fades + rises the `[data-anim-item]` children of the returned container each
 * time `signature` changes — for lists/tables that replay on filter/sort/page.
 * Uses WAAPI (not a keyed remount) so it fires even for rows React keeps
 * mounted across a filter change. Cancels the prior batch so rapid changes
 * don't stack. Compose `signature` from the visible id set (+ filter text) so
 * it changes exactly when the set does — not on background revalidation.
 * Pass `enabled: false` to skip the pass for a container that is currently
 * `display:none`, so it doesn't animate off-screen.
 */
export function useStaggerReveal<T extends HTMLElement = HTMLElement>(
  signature: string,
  enabled = true
) {
  const containerRef = useRef<T>(null);
  const runningRef = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    runningRef.current.forEach((a) => a.cancel());
    runningRef.current = [];
    const items = Array.from(
      el.querySelectorAll<HTMLElement>("[data-anim-item]")
    ).slice(0, MAX_REVEAL_ITEMS);
    items.forEach((item, i) => {
      const anim = animateIn(
        item,
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 260, delay: Math.min(i * 25, 200), fill: "backwards" }
      );
      if (anim) runningRef.current.push(anim);
    });
  }, [signature, enabled]);

  return containerRef;
}
