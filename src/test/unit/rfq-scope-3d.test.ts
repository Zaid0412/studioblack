import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RFQ-3d backend behaviours, executed against the REAL query functions
 * (imported by file path, bypassing the global `@/lib/queries` barrel mock)
 * with a controllable pool:
 *  - deleteBoqItem refuses an item that's on an RFQ (FK RESTRICT → friendly).
 *  - deleteBoqItemsBulk skips RFQ-linked items and reports the blocked count.
 *  - getRfqsByProject counts ready-for-procurement items not on any live RFQ.
 *  - getRfqDetail flags an excluded item as removed (in-flight only).
 */
// `mockQuery` = pool.query (getRfqsByProject / getRfqDetail). `mockClientQuery`
// = the transactional client used by the delete guards (BEGIN/COMMIT + tx SQL).
const { mockQuery, mockClientQuery, mockRelease } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getPool: () => ({
    query: mockQuery,
    connect: () =>
      Promise.resolve({ query: mockClientQuery, release: mockRelease }),
  }),
}));

import { deleteBoqItem, deleteBoqItemsBulk } from "@/lib/queries/boq";
import { getRfqsByProject, getRfqDetail } from "@/lib/queries/rfqs";

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

const clientSqls = () => mockClientQuery.mock.calls.map((c) => String(c[0]));

describe("deleteBoqItem — RFQ-3d live-RFQ guard", () => {
  it("maps the FK violation (23503) to in_rfq and rolls back", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/DELETE FROM boq_item/.test(sql))
        return Promise.reject({ code: "23503" });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await deleteBoqItem("item-1", "2026-07-04T00:00:00.000Z");
    expect(res).toEqual({ ok: false, reason: "in_rfq" });
    expect(clientSqls()).toContain("ROLLBACK");
  });

  it("releases cancelled/superseded RFQ rows, then deletes when not on a live RFQ", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/DELETE FROM boq_item/.test(sql))
        return Promise.resolve({ rowCount: 1 });
      return Promise.resolve({ rows: [] });
    });

    const res = await deleteBoqItem("item-1", "2026-07-04T00:00:00.000Z");
    expect(res).toEqual({ ok: true });
    const sqls = clientSqls();
    // Terminal RFQ references are released before the delete.
    expect(
      sqls.some((s) =>
        /DELETE FROM rfq_item[\s\S]*'cancelled', 'superseded'/.test(s)
      )
    ).toBe(true);
    expect(sqls).toContain("COMMIT");
  });

  it("rethrows non-FK errors", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/DELETE FROM boq_item/.test(sql))
        return Promise.reject({ code: "08006" });
      return Promise.resolve({ rows: [] });
    });

    await expect(
      deleteBoqItem("item-1", "2026-07-04T00:00:00.000Z")
    ).rejects.toMatchObject({ code: "08006" });
  });
});

describe("deleteBoqItemsBulk — RFQ-3d live-RFQ guard", () => {
  it("reports deleted + the true live-RFQ-blocked count (not requested - deleted)", async () => {
    // BEGIN → release → the counting SELECT → COMMIT.
    mockClientQuery.mockImplementation((sql: string) => {
      if (/WITH del AS/.test(sql))
        return Promise.resolve({ rows: [{ deleted: 1, blocked: 1 }] });
      return Promise.resolve({ rows: [] });
    });
    const res = await deleteBoqItemsBulk(["a", "b"], "boq-1");
    expect(res).toEqual({ deleted: 1, blocked: 1 });
    const sqls = clientSqls();
    expect(
      sqls.some((s) =>
        /DELETE FROM rfq_item[\s\S]*'cancelled', 'superseded'/.test(s)
      )
    ).toBe(true);
    expect(
      sqls.some((s) => /EXISTS[\s\S]*rfq_item[\s\S]*\) AS blocked/.test(s))
    ).toBe(true);
    expect(sqls).toContain("COMMIT");
  });

  it("short-circuits on an empty list", async () => {
    const res = await deleteBoqItemsBulk([], "boq-1");
    expect(res).toEqual({ deleted: 0, blocked: 0 });
    expect(mockClientQuery).not.toHaveBeenCalled();
  });
});

describe("getRfqsByProject — RFQ-3d ready-not-in-RFQ count", () => {
  it("returns the ready-for-procurement count alongside the rows", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/ready_for_procurement/.test(sql))
        return Promise.resolve({ rows: [{ n: 3 }] });
      // Main list query — no rows is fine for this assertion.
      return Promise.resolve({ rows: [] });
    });

    const res = await getRfqsByProject("proj-1", { page: 1, limit: 25 });
    expect(res.readyNotInRfq).toBe(3);
    // The count excludes excluded items and items on a live RFQ.
    const countSql = mockQuery.mock.calls
      .map((c) => String(c[0]))
      .find((s) => /ready_for_procurement/.test(s))!;
    expect(countSql).toMatch(/NOT bi\.is_excluded/);
    expect(countSql).toMatch(/NOT IN \('cancelled', 'superseded'\)/);
  });
});

describe("getRfqDetail — RFQ-3d removed-item flag", () => {
  const itemRow = {
    id: "ri-1",
    rfq_id: "rfq-1",
    boq_item_id: "bi-1",
    description: "Basin mixer",
    unit: "no",
    quantity: "2",
    spec_notes: null,
    sort_order: 0,
    awarded_vendor_id: null,
    awarded_quote_item_id: null,
    boq_quantity: "2",
    boq_description: "Basin mixer",
    boq_unit: "no",
    boq_excluded: true,
  };

  it("marks an excluded item as boq_removed and skips divergence, when in-flight", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/SELECT \* FROM rfq WHERE id/.test(sql))
        return Promise.resolve({
          rows: [{ id: "rfq-1", status: "issued", supersedes_rfq_id: null }],
        });
      if (/JOIN boq_item bi/.test(sql))
        return Promise.resolve({ rows: [itemRow] });
      return Promise.resolve({ rows: [] });
    });

    const res = await getRfqDetail("rfq-1");
    expect(res).not.toBeNull();
    expect(res!.items[0].boq_removed).toBe(true);
    // A removed item isn't also surfaced as a qty/spec divergence.
    expect(res!.items[0].boq_changes).toBeUndefined();
  });

  it("does not flag removal on a draft (not in-flight) RFQ", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (/SELECT \* FROM rfq WHERE id/.test(sql))
        return Promise.resolve({
          rows: [{ id: "rfq-1", status: "draft", supersedes_rfq_id: null }],
        });
      if (/JOIN boq_item bi/.test(sql))
        return Promise.resolve({ rows: [itemRow] });
      return Promise.resolve({ rows: [] });
    });

    const res = await getRfqDetail("rfq-1");
    expect(res!.items[0].boq_removed).toBeUndefined();
  });
});
