/**
 * Unit test for `addElementToBoq` — the only path that auto-sets
 * `source: 'library'` on a new BOQ row and copies the element's
 * `service_charge_pct` into the snapshot. The module-level mock in
 * `setup.ts` replaces this function with a stub, so we pull the real
 * implementation via `vi.importActual` and drive a sequenced pg mock.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BoqItemWithComputed } from "@/types";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function realAddElementToBoq(
  boqId: string,
  orgId: string,
  params: { sectionId: string | null; elementId: string; quantity?: number }
): Promise<BoqItemWithComputed | null> {
  const actual =
    await vi.importActual<typeof import("@/lib/queries/boq")>(
      "@/lib/queries/boq"
    );
  return actual.addElementToBoq(boqId, orgId, params);
}

const ORG = "org-test-001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const ELEMENT_ID = "550e8400-e29b-41d4-a716-446655440005";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addElementToBoq", () => {
  it("sets source='library' and copies service_charge_pct from the element", async () => {
    // 1. SELECT element row → returns the element being added
    // 2. createBoqItem WITH-CTE INSERT → returns the new boq_item with computed cols
    mocks.db.query
      .mockResolvedValueOnce({
        rows: [
          {
            code: "EL-001",
            name: "Porcelain tile 600x600",
            description: "Glazed porcelain",
            unit: "m2",
            unit_cost: "45.00",
            material_cost: "30.00",
            labour_cost: "10.00",
            overhead_pct: "5.00",
            service_charge_pct: "2.50",
            margin_pct: "15.00",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-item-id",
            source: "library",
            service_charge_pct: "2.50",
          },
        ],
      });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
      quantity: 3,
    });

    // First call is the element SELECT — verify it pulls service_charge_pct.
    const selectCall = mocks.db.query.mock.calls[0]!;
    expect(selectCall[0]).toContain("service_charge_pct");
    expect(selectCall[1]).toEqual([ELEMENT_ID]);

    // Second call is the createBoqItem INSERT — verify the params carry
    // source='library' (param $4) and the element's service_charge_pct
    // (param $13). Param positions match the INSERT column order in
    // `createBoqItem`.
    const insertCall = mocks.db.query.mock.calls[1]!;
    const params = insertCall[1] as unknown[];
    expect(insertCall[0]).toContain("INSERT INTO boq_item");
    expect(params[3]).toBe("library"); // $4 source
    expect(params[12]).toBe(2.5); // $13 service_charge_pct (from element)

    // The trailing SELECT applies the computed-cost columns, which now
    // include the service-charge factor between overhead and margin. Pin
    // that the formula was actually updated, not just the INSERT.
    expect(insertCall[0]).toMatch(
      /\(1 \+ COALESCE\(bi\.service_charge_pct, 0\)\/100\)/
    );
  });

  it("returns null when the element doesn't exist", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });
    const result = await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });
    expect(result).toBeNull();
    expect(mocks.db.query).toHaveBeenCalledTimes(1);
  });

  it("falls back to 0 when element.service_charge_pct is null", async () => {
    mocks.db.query
      .mockResolvedValueOnce({
        rows: [
          {
            code: "EL-002",
            name: "Latex paint",
            description: null,
            unit: "lm",
            unit_cost: "12.00",
            material_cost: null,
            labour_cost: null,
            overhead_pct: null,
            service_charge_pct: null,
            margin_pct: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "new-item-id", source: "library" }],
      });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });

    const insertCall = mocks.db.query.mock.calls[1]!;
    const params = insertCall[1] as unknown[];
    expect(params[12]).toBe(0); // service_charge_pct defaults to 0
  });
});
