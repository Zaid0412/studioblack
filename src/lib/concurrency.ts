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
