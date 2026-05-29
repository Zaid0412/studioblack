import { useEffect, useMemo, useRef } from "react";

interface UseLongPressOptions {
  /**
   * When false, `start` is a no-op — the timer never schedules. Useful
   * when long-press should only enter a mode (e.g. selection) and become
   * inert once that mode is active. Defaults to true.
   */
  enabled?: boolean;
  /** Hold duration before `onLongPress` fires. Defaults to 450ms. */
  durationMs?: number;
  /**
   * Vibrate(15) on fire when `navigator.vibrate` is supported. Lets the
   * user feel the gesture cross the threshold even on a silent device.
   * Defaults to true.
   */
  haptic?: boolean;
}

/**
 * Touch long-press gesture. Starts a timer on `start`; cancels on
 * `cancel`. On fire: triggers haptic feedback (if available) and invokes
 * `onLongPress` with whatever arg was passed to `start`. The synthetic
 * click that follows touchend must be swallowed by the caller via
 * `consumeFired()` — long-press is not a tap, so the row shouldn't open
 * or navigate as well.
 *
 * Two call styles:
 *
 *   // No per-target arg — spread `handlers`.
 *   const lp = useLongPress(() => enterSelection());
 *   <div {...lp.handlers} onClick={(e) => lp.consumeFired() || open()} />
 *
 *   // Per-target arg — call `start(arg)` yourself.
 *   const lp = useLongPress<string>((id) => toggle(id));
 *   <Card
 *     onTouchStart={() => lp.start(att.id)}
 *     onTouchMove={lp.cancel}
 *     onTouchEnd={lp.cancel}
 *     onContextMenu={lp.preventContextMenu}
 *     onClick={(e) => lp.consumeFired() || open(att.id)}
 *   />
 */
export function useLongPress<T = void>(
  onLongPress: (arg: T) => void,
  { enabled = true, durationMs = 450, haptic = true }: UseLongPressOptions = {}
) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  // Latest callback ref so closures don't capture a stale one without
  // forcing handler identity to change on every render. Synced in an
  // effect to keep render pure.
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => cancel, []);

  // Stable identity across renders — the start closure reads from refs so
  // it doesn't need to be rebuilt when callbacks change.
  const api = useMemo(
    () => ({
      start: (arg: T) => {
        if (!enabled) return;
        fired.current = false;
        cancel();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          if (
            haptic &&
            typeof navigator !== "undefined" &&
            "vibrate" in navigator
          ) {
            navigator.vibrate(15);
          }
          onLongPressRef.current(arg);
        }, durationMs);
      },
      cancel,
      /**
       * Mobile browsers pop a long-press context menu (share / copy /
       * etc.) that would interrupt the gesture. Bind this to
       * `onContextMenu` to suppress it only when we just fired —
       * desktop right-click stays usable.
       */
      preventContextMenu: (e: React.SyntheticEvent) => {
        if (fired.current) e.preventDefault();
      },
      /**
       * Reads + clears the fired flag. Call from your `onClick` to
       * swallow the synthetic click that follows touchend.
       */
      consumeFired: () => {
        const v = fired.current;
        fired.current = false;
        return v;
      },
    }),
    [enabled, durationMs, haptic]
  );

  /**
   * Convenience bundle for the no-arg case — spread directly:
   * `<div {...lp.handlers} />`.
   */
  const handlers = useMemo(
    () => ({
      onTouchStart: () => api.start(undefined as T),
      onTouchMove: api.cancel,
      onTouchEnd: api.cancel,
      onTouchCancel: api.cancel,
      onContextMenu: api.preventContextMenu,
    }),
    [api]
  );

  return { ...api, handlers };
}
