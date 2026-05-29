import { useEffect, useRef } from "react";

/**
 * Listens for the Escape key while `active` is true and calls `onDismiss`
 * when pressed. Cleans up the listener on unmount or when `active` flips
 * back to false. Used by mobile sheets / popovers that mirror native
 * `<select>` and Radix Popover dismissal semantics.
 *
 * `onDismiss` is held in a ref so callers don't need to memoize — the
 * keydown listener stays attached for the whole lifetime of `active`.
 */
export function useDismissOnEscape(active: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
