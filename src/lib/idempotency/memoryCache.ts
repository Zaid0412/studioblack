/**
 * In-memory LRU + TTL cache used as a fast-path in front of the Postgres-
 * backed import-idempotency tables. Covers the common case — a double-click
 * landing on the same replica — without a DB round-trip.
 *
 * Postgres remains the cross-replica source of truth. Without it, two
 * replicas could double-commit; the in-memory cache is purely a latency
 * optimisation on top.
 *
 * Eviction is strict LRU via `Map` insertion order. Bounded so a burst of
 * distinct imports cannot grow the Map unbounded.
 */
export interface ImportMemoryCache<T> {
  get(key: string): T | null;
  set(key: string, value: T): void;
}

export interface ImportMemoryCacheOptions {
  /** Maximum entries before LRU eviction. Defaults to 256. */
  max?: number;
  /** TTL in milliseconds. Defaults to 10 minutes. */
  ttlMs?: number;
}

export function createImportMemoryCache<T>(
  options: ImportMemoryCacheOptions = {}
): ImportMemoryCache<T> {
  const max = options.max ?? 256;
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000;
  const store = new Map<string, { at: number; value: T }>();

  return {
    get(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() - entry.at > ttlMs) {
        store.delete(key);
        return null;
      }
      // Mark most-recently-used by re-inserting at the tail.
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T): void {
      if (store.has(key)) store.delete(key);
      while (store.size >= max) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
      store.set(key, { at: Date.now(), value });
    },
  };
}
