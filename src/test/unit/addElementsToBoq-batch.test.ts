/**
 * Unit test for the batched, transactional `addElementsToBoq`. The rewrite runs
 * the whole "Add N to BoQ" action in ONE transaction: BEGIN + advisory lock, a
 * single batched element fetch, then one insert per row on the tx client,
 * COMMIT. On an unresolved element it ROLLs back and returns null — genuinely
 * all-or-nothing (vs the old per-item auto-commit that left partial rows).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BoqItemWithComputed } from "@/types";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function realAddElementsToBoq(
  boqId: string,
  orgId: string,
  params: Parameters<typeof import("@/lib/queries/boq").addElementsToBoq>[2]
): Promise<BoqItemWithComputed[] | null> {
  const actual =
    await vi.importActual<typeof import("@/lib/queries/boq")>(
      "@/lib/queries/boq"
    );
  return actual.addElementsToBoq(boqId, orgId, params);
}

const ORG = "org-test-001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const EL_A = "11111111-1111-4111-8111-111111111111";
const EL_B = "22222222-2222-4222-8222-222222222222";

/** An element row as the batched fetch returns it. */
const elementRow = (id: string, code: string) => ({
  id,
  code,
  name: code,
  description: `${code} desc`,
  unit: "m2",
  unit_cost: "10.00",
  material_cost: null,
  labour_cost: null,
  overhead_pct: null,
  service_charge_pct: null,
  margin_pct: null,
  client_rate: null,
  budget_rate: null,
  category_id: "cat-1",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addElementsToBoq (batched, transactional)", () => {
  it("inserts every element in one transaction with a single batched fetch", async () => {
    // Route by SQL shape: after the two inserts the batch does one BOQ-wide
    // renumber, then re-reads the inserted rows via ITEM_SELECT (that re-read is
    // what the function returns).
    mocks.db.query.mockImplementation((sql: string) => {
      if (/FROM element WHERE .* ANY/s.test(sql))
        return Promise.resolve({
          rows: [elementRow(EL_A, "EL-A"), elementRow(EL_B, "EL-B")],
        });
      if (/INSERT INTO boq_item/.test(sql))
        return Promise.resolve({ rows: [{ id: "new", source: "library" }] });
      if (/SELECT pr\.line_increment FROM boq pb/.test(sql))
        return Promise.resolve({ rows: [{ line_increment: 10 }] });
      if (/SELECT bi\.\*/.test(sql))
        return Promise.resolve({
          rows: [
            { id: "new-a", source: "library" },
            { id: "new-b", source: "library" },
          ],
        });
      return Promise.resolve({ rows: [] }); // BEGIN / lock / renumber / COMMIT
    });

    const result = await realAddElementsToBoq(BOQ_ID, ORG, {
      sectionId: null,
      items: [{ elementId: EL_A }, { elementId: EL_B }],
    });

    expect(result).toHaveLength(2);

    const calls = mocks.db.query.mock.calls.map((c) => String(c[0]));
    // Transaction boundaries + no rollback on the happy path.
    expect(calls[0]).toContain("BEGIN");
    expect(calls[calls.length - 1]).toContain("COMMIT");
    expect(calls.some((c) => c.includes("ROLLBACK"))).toBe(false);
    // ONE batched, org-scoped element fetch (not one per element).
    const fetchCalls = calls.filter(
      (c) => c.includes("FROM element") && c.includes("= ANY($1::uuid[])")
    );
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toContain("org_id = $2");
    // One INSERT per element.
    expect(
      calls.filter((c) => c.includes("INSERT INTO boq_item"))
    ).toHaveLength(2);
    // The batch renumbers once (BOQ-wide) rather than per row.
    expect(calls.filter((c) => c.includes("line_number = o.rn"))).toHaveLength(
      1
    );
  });

  it("rolls back and returns null when an element id is unresolved", async () => {
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [elementRow(EL_A, "EL-A")] }) // fetch — only A resolves
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const result = await realAddElementsToBoq(BOQ_ID, ORG, {
      sectionId: null,
      items: [{ elementId: EL_A }, { elementId: EL_B }],
    });

    expect(result).toBeNull();
    const calls = mocks.db.query.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("ROLLBACK"))).toBe(true);
    // Nothing was inserted.
    expect(calls.some((c) => c.includes("INSERT INTO boq_item"))).toBe(false);
  });

  it("returns [] without opening a transaction for empty input", async () => {
    const result = await realAddElementsToBoq(BOQ_ID, ORG, {
      sectionId: null,
      items: [],
    });
    expect(result).toEqual([]);
    expect(mocks.db.connect).not.toHaveBeenCalled();
  });
});
