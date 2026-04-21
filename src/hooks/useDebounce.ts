"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Returns a debounced copy of `value` — the copy only updates after `delayMs`
 * of idle time. Rapid updates reset the timer so only the latest settled
 * value surfaces to consumers.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Returns a stable callback that, when invoked, schedules `fn(...args)` to run
 * after `delayMs` of idle time. Subsequent invocations cancel the pending
 * call. The timer is cleared on unmount. `fn` is tracked via ref so callers
 * can pass inline arrow functions without resetting the timer on every render.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs]
  );
}
