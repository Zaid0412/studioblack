import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  checkServiceAreas,
  elementCodePrefix,
  nextElementCodes,
  requireServiceArea,
  syncElementCounter,
} from "@/lib/queries/sequences";

const ORG = "org-test-001";
const CAT = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

/** Minimal stand-in for a pg executor that returns canned rows. */
function stubExecutor(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { executor: { query } as unknown as Pool, query };
}

describe("elementCodePrefix", () => {
  it("uses the category's full path code", async () => {
    const { executor } = stubExecutor([{ code_prefix: "KIT-CAB-BASE" }]);
    await expect(elementCodePrefix(executor, ORG, CAT)).resolves.toBe(
      "KIT-CAB-BASE"
    );
  });

  // Any level is allowed — a category (KIT) and a sub-category (KIT-CAB) code
  // just as happily as a service area.
  it("uses whatever level the category sits at", async () => {
    const { executor } = stubExecutor([{ code_prefix: "KIT" }]);
    await expect(elementCodePrefix(executor, ORG, CAT)).resolves.toBe("KIT");
  });

  it("falls back to GEN when the element has no category", async () => {
    const { executor, query } = stubExecutor([]);
    await expect(elementCodePrefix(executor, ORG, null)).resolves.toBe("GEN");
    // No category means nothing to look up.
    expect(query).not.toHaveBeenCalled();
  });

  it("falls back to GEN when the category has no code", async () => {
    const { executor } = stubExecutor([{ code_prefix: null }]);
    await expect(elementCodePrefix(executor, ORG, CAT)).resolves.toBe("GEN");
  });

  it("falls back to GEN when the category's code is blank", async () => {
    const { executor } = stubExecutor([{ code_prefix: "   " }]);
    await expect(elementCodePrefix(executor, ORG, CAT)).resolves.toBe("GEN");
  });

  // A category id that doesn't resolve (deleted, or another org's) must not
  // take the whole create down.
  it("falls back to GEN when the category doesn't exist in this org", async () => {
    const { executor } = stubExecutor([]);
    await expect(elementCodePrefix(executor, ORG, CAT)).resolves.toBe("GEN");
  });

  it("scopes the lookup to the org", async () => {
    const { executor, query } = stubExecutor([{ code_prefix: "KIT" }]);
    await elementCodePrefix(executor, ORG, CAT);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("org_id = $2"), [
      CAT,
      ORG,
    ]);
  });
});

// The gate that actually enforces "elements sit under a Service Area" — the
// picker is a convenience, this is the rule.
describe("requireServiceArea", () => {
  it("returns the Service Area's path code", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 3, code_prefix: "KIT-CAB-BASE" },
    ]);
    await expect(requireServiceArea(executor, ORG, CAT)).resolves.toBe(
      "KIT-CAB-BASE"
    );
  });

  it("rejects a Category (level 1)", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 1, code_prefix: "KIT" },
    ]);
    await expect(requireServiceArea(executor, ORG, CAT)).rejects.toThrow(
      "Category must be a Service Area"
    );
  });

  it("rejects a Sub-category (level 2)", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 2, code_prefix: "KIT-CAB" },
    ]);
    await expect(requireServiceArea(executor, ORG, CAT)).rejects.toThrow(
      "Category must be a Service Area"
    );
  });

  // Scoped to the org, so a foreign category id reads as missing rather than
  // resolving — which is also what stops an element pointing at another org's
  // taxonomy and leaking its names back through `category_path`.
  it("rejects a category the org doesn't own", async () => {
    const { executor, query } = stubExecutor([]);
    await expect(requireServiceArea(executor, ORG, CAT)).rejects.toThrow(
      "Category not found"
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("org_id = $1"), [
      ORG,
      [CAT],
    ]);
  });

  it("falls back to GEN when a Service Area somehow carries no code", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 3, code_prefix: null },
    ]);
    await expect(requireServiceArea(executor, ORG, CAT)).resolves.toBe("GEN");
  });
});

// The batch form the list surfaces use — vendor trades, rate-contract items,
// the BOQ import. Same rule, one query for the whole set.
describe("checkServiceAreas", () => {
  const CAT2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  it("names the ids that aren't Service Areas", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 3, code_prefix: "KIT-CAB-BASE" },
      { id: CAT2, level: 2, code_prefix: "KIT-CAB" },
    ]);
    await expect(
      checkServiceAreas(executor, ORG, [CAT, CAT2])
    ).resolves.toEqual({
      ok: false,
      reason: "category_not_service_area",
      invalidIds: [CAT2],
    });
  });

  it("names the ids the org doesn't own", async () => {
    const { executor } = stubExecutor([
      { id: CAT, level: 3, code_prefix: "KIT-CAB-BASE" },
    ]);
    await expect(
      checkServiceAreas(executor, ORG, [CAT, CAT2])
    ).resolves.toEqual({
      ok: false,
      reason: "category_not_found",
      invalidIds: [CAT2],
    });
  });

  it("dedupes, and doesn't query for an empty list", async () => {
    const { executor, query } = stubExecutor([]);
    await expect(checkServiceAreas(executor, ORG, [])).resolves.toEqual({
      ok: true,
      prefixes: new Map(),
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("nextElementCodes", () => {
  it("pads the sequence to 4 digits", async () => {
    const { executor } = stubExecutor([{ current_value: 1 }]);
    await expect(
      nextElementCodes(executor, ORG, "KIT-CAB-BASE", 1)
    ).resolves.toEqual(["KIT-CAB-BASE-0001"]);
  });

  // The counter never resets, so element codes carry no year — unlike the
  // document sequences (BOQ-2026-001).
  it("never resets by year", async () => {
    const { executor, query } = stubExecutor([{ current_value: 7 }]);
    const [code] = await nextElementCodes(executor, ORG, "KIT", 1);
    expect(code).toBe("KIT-0007");
    expect(query).toHaveBeenCalledWith(expect.any(String), [ORG, "KIT", 0, 1]);
  });

  it("returns a contiguous block when claiming several at once", async () => {
    // The counter lands on 5 after a bulk advance of 3, so the block is 3..5.
    const { executor } = stubExecutor([{ current_value: 5 }]);
    await expect(nextElementCodes(executor, ORG, "GEN", 3)).resolves.toEqual([
      "GEN-0003",
      "GEN-0004",
      "GEN-0005",
    ]);
  });

  it("keeps counting past 9999 instead of truncating", async () => {
    const { executor } = stubExecutor([{ current_value: 10_000 }]);
    await expect(nextElementCodes(executor, ORG, "KIT", 1)).resolves.toEqual([
      "KIT-10000",
    ]);
  });

  it("claims nothing — and touches no counter — for a count of zero", async () => {
    const { executor, query } = stubExecutor([]);
    await expect(nextElementCodes(executor, ORG, "KIT", 0)).resolves.toEqual(
      []
    );
    expect(query).not.toHaveBeenCalled();
  });
});

// The Excel import inserts the codes it is given verbatim and never advances
// the counter. Without this, an org that imported KIT-0001..KIT-0005 could
// never create another element in that category — the generated code would
// collide, the transaction would roll the counter back, and the next attempt
// would fail identically.
describe("syncElementCounter", () => {
  it("fast-forwards the counter to the highest code already issued", async () => {
    const { executor, query } = stubExecutor([{ max_seq: "5" }]);
    await syncElementCounter(executor, ORG, "KIT");

    const seed = query.mock.calls[1];
    expect(seed[0]).toContain("INSERT INTO sequence_counter");
    // GREATEST, so a counter that is already ahead is never dragged backwards.
    expect(seed[0]).toContain("GREATEST");
    expect(seed[1]).toEqual([ORG, "KIT", 0, 5]);
  });

  it("only counts codes shaped <prefix>-<digits>", async () => {
    const { executor, query } = stubExecutor([{ max_seq: null }]);
    await syncElementCounter(executor, ORG, "KIT");

    // A hand-written KIT-SPECIAL is not a sequence number: the digits-only
    // filter rejects it, MAX comes back NULL, and no counter row is written.
    expect(query.mock.calls[0][0]).toContain("^[0-9]+$");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("escapes the prefix before using it in LIKE", async () => {
    const { executor, query } = stubExecutor([{ max_seq: null }]);
    await syncElementCounter(executor, ORG, "A_B");

    // Unescaped, `_` is a LIKE wildcard and would sweep in AXB-0001.
    expect(query.mock.calls[0][1]).toEqual([ORG, "A_B", "A\\_B"]);
  });
});
