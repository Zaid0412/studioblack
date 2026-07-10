/**
 * Unit test for the batch `getBestRateForElements`. The N+1 rewrite issues a
 * SINGLE set-based query for the whole element set (was one recursive-CTE query
 * per element). Pulls the real implementation via `vi.importActual` and drives a
 * mocked pg pool, asserting the single-query contract + the per-element mapping
 * (best row kept, no-match seeded to null, rate coerced to number, ids deduped).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AvailableRate } from "@/types";
import { mocks } from "../setup";

async function realGetBestRateForElements(
  orgId: string,
  ids: string[]
): Promise<Record<string, AvailableRate | null>> {
  const actual = await vi.importActual<
    typeof import("@/lib/queries/rateContracts")
  >("@/lib/queries/rateContracts");
  return actual.getBestRateForElements(orgId, ids);
}

const ORG = "org-test-001";
const EL_A = "11111111-1111-4111-8111-111111111111";
const EL_B = "22222222-2222-4222-8222-222222222222";

/** A candidate row as the batch query returns it (incl. the `input_element_id` key). */
const rowForA = {
  input_element_id: EL_A,
  rate_contract_item_id: "rci-1",
  rate_contract_id: "rc-1",
  contract_number: "RC-2026-001",
  contract_name: "Test contract",
  vendor_id: "v-1",
  vendor_name: "Acme",
  category_id: "cat-1",
  category_name: "Base Cabinets",
  category_code: "BC",
  element_id: null,
  element_code: null,
  element_name: null,
  unit: "m2",
  rate: "450.00",
  currency: "USD",
  end_date: "2026-12-31",
  match_type: "service_area",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBestRateForElements (batch)", () => {
  it("issues a single query and maps best-rate per element, null for no-match", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [rowForA] });

    // EL_A appears twice → must be deduped; EL_B has no matching row.
    const result = await realGetBestRateForElements(ORG, [EL_A, EL_B, EL_A]);

    // One query for the whole batch (the N+1 fix).
    expect(mocks.db.query).toHaveBeenCalledTimes(1);
    // Param shape: [orgId, uniqueIds].
    const [, params] = mocks.db.query.mock.calls[0]!;
    expect(params[0]).toBe(ORG);
    expect(params[1]).toEqual([EL_A, EL_B]);

    // Both input ids are present as keys.
    expect(Object.keys(result).sort()).toEqual([EL_A, EL_B].sort());
    // Matched element → mapped AvailableRate with numeric rate, no leaked key.
    expect(result[EL_A]).toMatchObject({
      rate_contract_item_id: "rci-1",
      match_type: "service_area",
      rate: 450,
    });
    expect(typeof result[EL_A]!.rate).toBe("number");
    expect(result[EL_A]).not.toHaveProperty("input_element_id");
    // No-match element → null.
    expect(result[EL_B]).toBeNull();
  });

  it("returns {} and issues no query for empty input", async () => {
    const result = await realGetBestRateForElements(ORG, []);
    expect(result).toEqual({});
    expect(mocks.db.query).not.toHaveBeenCalled();
  });
});
