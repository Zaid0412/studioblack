/**
 * Unit test for `addElementToBoq` — the only path that auto-sets
 * `source: 'library'` on a new BOQ row and copies the element's
 * `service_charge_pct` into the snapshot. The module-level mock in
 * `setup.ts` replaces this function with a stub, so we pull the real
 * implementation via `vi.importActual` and drive a shape-routed pg mock.
 *
 * `addElementToBoq` delegates the insert to `addBoqItem`, which wraps it in a
 * transaction (BEGIN / lock / INSERT / renumber / re-select / COMMIT), so the
 * mock routes by SQL shape rather than call order.
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

/** Route the pooled/client query mock by SQL shape. */
function wire(elementRow: Record<string, unknown> | null) {
  mocks.db.query.mockImplementation((sql: string) => {
    if (/FROM element WHERE/.test(sql))
      return Promise.resolve({ rows: elementRow ? [elementRow] : [] });
    if (/INSERT INTO boq_item/.test(sql))
      return Promise.resolve({
        rows: [{ id: "new-item-id", source: "library" }],
      });
    if (/SELECT pr\.line_increment FROM boq pb/.test(sql))
      return Promise.resolve({ rows: [{ line_increment: 10 }] });
    // ITEM_SELECT re-read after the renumber.
    if (/SELECT bi\.\*/.test(sql))
      return Promise.resolve({
        rows: [{ id: "new-item-id", source: "library" }],
      });
    return Promise.resolve({ rows: [], rowCount: 0 }); // BEGIN / lock / renumber / COMMIT
  });
}

/** The createBoqItem INSERT call, found by shape. */
const insertParams = () =>
  mocks.db.query.mock.calls.find((c) =>
    /INSERT INTO boq_item/.test(String(c[0]))
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addElementToBoq", () => {
  it("sets source='library' and copies service_charge_pct from the element", async () => {
    wire({
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
      client_rate: null,
      budget_rate: null,
    });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
      quantity: 3,
    });

    // The element SELECT pulls service_charge_pct and is org-scoped.
    const selectCall = mocks.db.query.mock.calls.find((c) =>
      /FROM element WHERE/.test(String(c[0]))
    )!;
    expect(selectCall[0]).toContain("service_charge_pct");
    expect(selectCall[0]).toContain("org_id = $2");
    expect(selectCall[1]).toEqual([ELEMENT_ID, ORG]);

    // The createBoqItem INSERT carries source='library' ($4) and the element's
    // service_charge_pct ($15). Param positions match createBoqItem's columns;
    // the length guard surfaces a future column addition that would shift them.
    const insertCall = insertParams()!;
    const params = insertCall[1] as unknown[];
    expect(insertCall[0]).toContain("INSERT INTO boq_item");
    expect(params.length).toBe(29); // $29 is the optional explicit line_number
    expect(params[3]).toBe("library"); // $4 source
    expect(params[4]).toBe(null); // $5 rate_contract_item_id
    expect(params[6]).toBe(null); // $7 name (not auto-copied from element)
    expect(params[14]).toBe(2.5); // $15 service_charge_pct (from element)
    expect(params[27]).toBe(null); // $28 category_id (element had none)

    expect(insertCall[0]).toMatch(
      /\(1 \+ COALESCE\(bi\.service_charge_pct, 0\)\/100\)/
    );
  });

  it("returns null when the element doesn't exist", async () => {
    wire(null);
    const result = await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });
    expect(result).toBeNull();
    expect(insertParams()).toBeUndefined(); // nothing inserted
  });

  it("falls back to 0 when element.service_charge_pct is null", async () => {
    wire({
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
      client_rate: null,
      budget_rate: null,
    });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });

    const params = insertParams()![1] as unknown[];
    expect(params[14]).toBe(0); // service_charge_pct defaults to 0
  });

  it("inherits client_rate / budget_rate from the source element", async () => {
    wire({
      code: "EL-003",
      name: "Custom-tier item",
      description: "Cherry-on-top",
      unit: "no",
      unit_cost: "100.00",
      material_cost: null,
      labour_cost: null,
      overhead_pct: null,
      service_charge_pct: null,
      margin_pct: null,
      client_rate: "175.00",
      budget_rate: "85.00",
    });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });

    const params = insertParams()![1] as unknown[];
    expect(params[16]).toBe(175); // $17 client_rate
    expect(params[17]).toBe(85); // $18 budget_rate
  });

  it("passes null for client_rate / budget_rate when the element has none", async () => {
    wire({
      code: "EL-004",
      name: "Plain item",
      description: null,
      unit: "no",
      unit_cost: "50.00",
      material_cost: null,
      labour_cost: null,
      overhead_pct: null,
      service_charge_pct: null,
      margin_pct: null,
      client_rate: null,
      budget_rate: null,
    });

    await realAddElementToBoq(BOQ_ID, ORG, {
      sectionId: null,
      elementId: ELEMENT_ID,
    });

    const params = insertParams()![1] as unknown[];
    expect(params[16]).toBeNull();
    expect(params[17]).toBeNull();
  });
});
