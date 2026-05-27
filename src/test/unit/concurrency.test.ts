import { describe, it, expect, vi } from "vitest";

import {
  runWithConcurrency,
  runSettledWithConcurrency,
} from "@/lib/concurrency";

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

describe("runSettledWithConcurrency", () => {
  it("returns empty results for count=0", async () => {
    const task = vi.fn();
    const results = await runSettledWithConcurrency(0, 3, task);
    expect(results).toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it("throws when limit is less than 1", async () => {
    await expect(
      runSettledWithConcurrency(3, 0, async () => 1)
    ).rejects.toThrow(/limit must be >= 1/);
  });

  it("returns ok results in input order even when completion order differs", async () => {
    const results = await runSettledWithConcurrency(4, 2, async (i) => {
      await new Promise((r) => setTimeout(r, (4 - i) * 4));
      return `v${i}`;
    });
    expect(results).toEqual([
      { ok: true, value: "v0" },
      { ok: true, value: "v1" },
      { ok: true, value: "v2" },
      { ok: true, value: "v3" },
    ]);
  });

  it("collects partial failures without aborting siblings", async () => {
    const results = await runSettledWithConcurrency(5, 3, async (i) => {
      if (i === 1 || i === 3) throw new Error(`fail-${i}`);
      return i * 10;
    });
    expect(results.map((r) => r.ok)).toEqual([true, false, true, false, true]);
    expect(results[0]).toEqual({ ok: true, value: 0 });
    expect((results[1] as { ok: false; error: Error }).error.message).toBe(
      "fail-1"
    );
    expect(results[2]).toEqual({ ok: true, value: 20 });
    expect(results[4]).toEqual({ ok: true, value: 40 });
  });

  it("fires onSettled exactly once per index with the matching result", async () => {
    const settled: Array<[number, boolean]> = [];
    await runSettledWithConcurrency(
      4,
      2,
      async (i) => {
        if (i === 2) throw new Error("nope");
        return i;
      },
      (i, r) => {
        settled.push([i, r.ok]);
      }
    );
    settled.sort(([a], [b]) => a - b);
    expect(settled).toEqual([
      [0, true],
      [1, true],
      [2, false],
      [3, true],
    ]);
  });

  it("respects the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await runSettledWithConcurrency(6, 2, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("stops claiming new work after the signal aborts", async () => {
    const controller = new AbortController();
    const claimed: number[] = [];
    // Abort mid-batch — the first two start, then abort fires, then the
    // remaining four indices should be reported as aborted without ever
    // calling `task`.
    const promise = runSettledWithConcurrency(
      6,
      2,
      async (i) => {
        claimed.push(i);
        await new Promise((r) => setTimeout(r, 5));
        return i;
      },
      undefined,
      controller.signal
    );
    await new Promise((r) => setTimeout(r, 1));
    controller.abort();
    const results = await promise;
    expect(results).toHaveLength(6);
    expect(claimed.length).toBeLessThan(6);
    // Slots that never ran are filled with the abort error.
    const unstarted = results.filter((r) => !r.ok).length;
    expect(unstarted).toBeGreaterThan(0);
  });
});
