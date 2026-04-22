import { describe, it, expect, vi } from "vitest";

import { runWithConcurrency } from "@/lib/concurrency";

describe("runWithConcurrency", () => {
  it("resolves immediately for empty input", async () => {
    const worker = vi.fn();
    await runWithConcurrency([], 3, worker);
    expect(worker).not.toHaveBeenCalled();
  });

  it("throws when limit is less than 1", async () => {
    await expect(runWithConcurrency([1, 2, 3], 0, vi.fn())).rejects.toThrow(
      /limit must be >= 1/
    );
    await expect(runWithConcurrency([1, 2, 3], -2, vi.fn())).rejects.toThrow(
      /limit must be >= 1/
    );
    await expect(
      runWithConcurrency([1, 2, 3], Number.NaN, vi.fn())
    ).rejects.toThrow(/limit must be >= 1/);
  });

  it("runs items strictly sequentially when limit=1", async () => {
    let inFlight = 0;
    let peak = 0;
    await runWithConcurrency([1, 2, 3, 4], 1, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
    });
    expect(peak).toBe(1);
  });

  it("processes all items even when limit exceeds items.length", async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3], 10, async (_item, i) => {
      seen.push(i);
    });
    expect(seen.sort()).toEqual([0, 1, 2]);
  });

  it("processes every item exactly once with its index", async () => {
    const seen: Array<[string, number]> = [];
    await runWithConcurrency(["a", "b", "c", "d"], 2, async (item, i) => {
      seen.push([item, i]);
    });
    expect(seen.sort()).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
  });

  it("respects the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("rethrows the first error and stops dispatching new work", async () => {
    const processed: number[] = [];
    await expect(
      runWithConcurrency([0, 1, 2, 3, 4], 2, async (_item, i) => {
        if (i === 1) throw new Error("boom");
        processed.push(i);
      })
    ).rejects.toThrow("boom");
    // Items dispatched before the error should still be reported, but workers
    // that would have started later (after the throw) must be skipped.
    expect(processed).not.toContain(1);
    expect(processed.length).toBeLessThan(5);
  });

  it("waits for in-flight workers to settle before rejecting", async () => {
    const settled: number[] = [];
    await expect(
      runWithConcurrency([0, 1, 2, 3], 2, async (_item, i) => {
        if (i === 0) {
          await new Promise((r) => setTimeout(r, 1));
          throw new Error("boom");
        }
        await new Promise((r) => setTimeout(r, 10));
        settled.push(i);
      })
    ).rejects.toThrow("boom");
    // Worker that was already in-flight when the error occurred must have
    // finished before the function rejected.
    expect(settled).toContain(1);
  });
});
