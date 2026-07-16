import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Line numbers are BOQ-wide continuous (not per-section). These pin the three
 * levers that enforce that: createBoqItem appends from the whole-BOQ MAX, and
 * reorder / move re-flow the whole BOQ via `renumberBoqContinuous` under the
 * `boq-lines:` advisory lock. We run the REAL query fns against a shape-routed
 * pooled client.
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

const calls = () => mockQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockQuery.mockReset();
  mockRelease.mockReset();
});

describe("BOQ-wide continuous line numbers", () => {
  it("createBoqItem appends line_number from the whole BOQ, not the section", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/INSERT INTO boq_item/.test(sql))
        return Promise.resolve({ rows: [{ id: "new" }] });
      // Custom lines now auto-generate item_code from the shared sequence.
      if (/INSERT INTO sequence_counter/.test(sql))
        return Promise.resolve({ rows: [{ current_value: 1 }] });
      return Promise.resolve({ rows: [] });
    });

    await createBoqItem("boq-1", "org-1", {
      sectionId: "sec-1",
      categoryId: "cat-1",
      description: "x",
      unit: "m2",
    });

    const insertSql = calls().find((c) => c.includes("INSERT INTO boq_item"))!;
    // The line_number append is BOQ-wide: MAX over the whole boq, with no
    // per-section filter on that subquery.
    expect(insertSql).toContain(
      "SELECT COALESCE(MAX(line_number), 0) FROM boq_item WHERE boq_id = $1)"
    );
    // sort_order stays section-scoped.
    expect(insertSql).toContain(
      "MAX(sort_order), -1) + 1 FROM boq_item WHERE boq_id = $1 AND section_id IS NOT DISTINCT FROM $2"
    );
  });

  it("reorderBoqItems rewrites sort_order then renumbers the whole BOQ under the lock", async () => {
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
    // One BOQ-wide renumber.
    expect(c.some((s) => s.includes("line_number = o.rn"))).toBe(true);
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
