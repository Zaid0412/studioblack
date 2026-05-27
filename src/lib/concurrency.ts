/**
 * Run async workers over items with bounded concurrency. Stops dispatching new
 * work on the first rejection but waits for already-running workers to settle
 * so their side-effects stay observable (e.g. marking succeeded indices before
 * the caller handles the error).
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("runWithConcurrency: limit must be >= 1");
  }
  if (items.length === 0) return;

  let cursor = 0;
  let firstError: unknown = null;

  const runOne = async () => {
    while (firstError === null) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        await worker(items[i], i);
      } catch (err) {
        if (firstError === null) firstError = err;
        return;
      }
    }
  };

  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, runOne));
  if (firstError !== null) throw firstError;
}

export type SettledResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

/**
 * Run N async tasks with bounded concurrency and collect *every* outcome —
 * unlike `runWithConcurrency`, a single failure doesn't abort siblings.
 * Each task is called with its index, and `onSettled` (if provided) fires
 * as each individual task resolves so callers can update per-task UI
 * mid-flight (progress counters, status icons).
 *
 * When the optional `signal` aborts, workers stop claiming new indices.
 * Already-running tasks must wire the signal into their own fetch / await
 * calls — `runSettledWithConcurrency` can't cancel work it doesn't own.
 * Indices that hadn't started yet land as `{ ok: false, error: <abort> }`
 * so result-array slots stay in input order.
 *
 * Results are returned in input order, one per index.
 */
export async function runSettledWithConcurrency<T>(
  count: number,
  limit: number,
  task: (index: number) => Promise<T>,
  onSettled?: (index: number, result: SettledResult<T>) => void,
  signal?: AbortSignal
): Promise<SettledResult<T>[]> {
  if (count <= 0) return [];
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("runSettledWithConcurrency: limit must be >= 1");
  }
  const results = new Array<SettledResult<T>>(count);
  let cursor = 0;

  const runOne = async () => {
    while (true) {
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= count) return;
      let result: SettledResult<T>;
      try {
        result = { ok: true, value: await task(i) };
      } catch (error) {
        result = { ok: false, error };
      }
      results[i] = result;
      onSettled?.(i, result);
    }
  };

  const n = Math.min(limit, count);
  await Promise.all(Array.from({ length: n }, runOne));

  // Fill any never-claimed slots with abort errors so callers can rely on
  // `results.length === count` and one entry per index.
  if (signal?.aborted) {
    const abortError = signal.reason ?? new Error("Aborted");
    for (let i = 0; i < count; i++) {
      if (!results[i]) results[i] = { ok: false, error: abortError };
    }
  }

  return results;
}
