import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Line numbers restart per division (`DIV -> 10, 20, 30…`), not BOQ-wide. These
 * pin the levers that enforce that: createBoqItem appends from the MAX within the
 * line's division and resolves a mandatory division when none is supplied, and
 * reorder / move re-flow the BOQ per division via `renumberBoqContinuous` under
 * the `boq-lines:` advisory lock. We run the REAL query fns against a
 * shape-routed pooled client.
 */
const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => {
  const q = vi.fn();
  return {
    mockQuery: q,
    mockRelease: vi.fn(),
    mockConnect: vi.fn(() => Promise.resolve({ query: q, release: vi.fn() })),
  };
});
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery, connect: mockConnect }),
}));

import { createBoqItem, reorderBoqItems, moveBoqItem } from "@/lib/queries/boq";
import type { PoolClient } from "pg";

// createBoqItem's code-generation branch requires a transaction client (has
// `release`), so drive it with one rather than the pool default.
const txClient = {
  query: mockQuery,
  release: () => {},
} as unknown as PoolClient;

const calls = () => mockQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockQuery.mockReset();
  mockRelease.mockReset();
});

describe("per-division line numbers", () => {
  it("createBoqItem appends line_number from the item's division, not the whole BOQ", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/INSERT INTO boq_item/.test(sql))
        return Promise.resolve({ rows: [{ id: "new" }] });
      // Custom lines auto-generate item_code from the shared sequence.
      if (/INSERT INTO sequence_counter/.test(sql))
        return Promise.resolve({ rows: [{ current_value: 1 }] });
      return Promise.resolve({ rows: [] });
    });

    await createBoqItem(
      "boq-1",
      "org-1",
      {
        sectionId: "sec-1",
        divisionId: "div-1",
        categoryId: "cat-1",
        description: "x",
        unit: "m2",
      },
      txClient
    );

    const insertSql = calls().find((c) => c.includes("INSERT INTO boq_item"))!;
    // The line_number append is scoped to the line's division.
    expect(insertSql).toContain(
      "SELECT COALESCE(MAX(line_number), 0) FROM boq_item WHERE boq_id = $1 AND division_id = $30::uuid)"
    );
    // sort_order stays section-scoped.
    expect(insertSql).toContain(
      "MAX(sort_order), -1) + 1 FROM boq_item WHERE boq_id = $1 AND section_id IS NOT DISTINCT FROM $2"
    );
    // The resolved division is bound as the last param ($30).
    const params = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("INSERT INTO boq_item")
    )![1] as unknown[];
    expect(params[29]).toBe("div-1");
  });

  it("createBoqItem resolves a division (section's, else GEN) when none is supplied", async () => {
    mockQuery.mockImplementation((sql: string) => {
      // The resolution SELECT — section's division, else the org's GEN.
      if (/lower\(d\.code\) = 'gen'/.test(sql))
        return Promise.resolve({ rows: [{ id: "gen-div" }] });
      if (/INSERT INTO boq_item/.test(sql))
        return Promise.resolve({ rows: [{ id: "new" }] });
      if (/INSERT INTO sequence_counter/.test(sql))
        return Promise.resolve({ rows: [{ current_value: 1 }] });
      return Promise.resolve({ rows: [] });
    });

    await createBoqItem(
      "boq-1",
      "org-1",
      { sectionId: null, categoryId: "cat-1", description: "x", unit: "m2" },
      txClient
    );

    // The resolved GEN division is bound to the insert.
    const params = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("INSERT INTO boq_item")
    )![1] as unknown[];
    expect(params[29]).toBe("gen-div");
  });

  it("reorderBoqItems rewrites sort_order then renumbers per division under the lock", async () => {
    mockQuery.mockResolvedValue({ rows: [{ line_increment: 10 }] });

    await reorderBoqItems("boq-1", "sec-1", ["a", "b", "c"]);

    const c = calls();
    expect(c[0]).toContain("BEGIN");
    expect(c.some((s) => s.includes("pg_advisory_xact_lock"))).toBe(true);
    // Section-local sort_order rewrite — but NOT the old per-section line_number.
    const sortUpdate = c.find(
      (s) => s.includes("SET sort_order = data.pos") && s.includes("boq_item")
    )!;
    expect(sortUpdate).not.toContain("line_number = (data.pos");
    // One per-division renumber (partitioned by division_id).
    const renumber = c.find((s) => s.includes("line_number = o.rn"))!;
    expect(renumber).toContain("PARTITION BY bi.division_id");
    expect(c[c.length - 1]).toContain("COMMIT");
  });

  it("moveBoqItem re-flows the BOQ's numbers after the move", async () => {
    mockQuery.mockImplementation((sql: string) => {
      // Target-section-belongs-to-same-BOQ check.
      if (/FROM boq_section bs[\s\S]*JOIN boq_item bi/.test(sql))
        return Promise.resolve({ rows: [{ ok: 1 }] });
      if (/SELECT boq_id FROM boq_item/.test(sql))
        return Promise.resolve({ rows: [{ boq_id: "boq-1" }] });
      if (/SELECT pr\.line_increment/.test(sql))
        return Promise.resolve({ rows: [{ line_increment: 10 }] });
      if (/UPDATE boq_item[\s\S]*section_id = \$1/.test(sql))
        return Promise.resolve({ rowCount: 1 });
      if (/SELECT bi\.\*/.test(sql))
        return Promise.resolve({ rows: [{ id: "item-1" }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await moveBoqItem(
      "item-1",
      "sec-2",
      "2026-01-01T00:00:00.000Z"
    );

    expect(res.ok).toBe(true);
    const c = calls();
    expect(c.some((s) => s.includes("pg_advisory_xact_lock"))).toBe(true);
    // The move UPDATE no longer sets line_number itself — the renumber does.
    const moveUpdate = c.find(
      (s) => s.includes("SET section_id = $1") && s.includes("UPDATE boq_item")
    )!;
    expect(moveUpdate).not.toContain("line_number =");
    expect(c.some((s) => s.includes("line_number = o.rn"))).toBe(true);
  });
});
