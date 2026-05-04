"use client";

import { useEffect, useRef } from "react";

/**
 * Resync local form state when a server-driven prop genuinely changes.
 *
 * Compares a stringified snapshot of `value` against the previous one — SWR
 * routinely returns a new reference for unchanged data on `revalidateOnFocus`,
 * which would otherwise blow away in-flight edits via the naive
 * `useEffect(() => setLocal(value), [value])` pattern.
 *
 * Only fires `apply(value)` when the JSON-serialised form changes, so identical
 * payloads don't disturb local state. Real server changes still propagate.
 *
 * `apply` is included in deps but the seed-equality check short-circuits when
 * only the callback identity changed — keeps the linter happy without
 * spurious re-applies.
 */
export function useResyncFromProp<T>(value: T, apply: (next: T) => void): void {
  const lastSeedRef = useRef<string>("");
  useEffect(() => {
    const seed = JSON.stringify(value ?? null);
    if (seed === lastSeedRef.current) return;
    lastSeedRef.current = seed;
    apply(value);
  }, [value, apply]);
}
