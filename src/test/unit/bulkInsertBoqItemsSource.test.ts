/**
 * Targeted test for the `source` derivation in `bulkInsertBoqItems`.
 * The Excel-import path can't ask the user to set provenance, so the SQL
 * derives it from `element_id`: rows that match a library element become
 * `'library'`, the rest stay `'custom'`. This test pins that contract.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BulkBoqImportResult } from "@/types";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function realBulkInsertBoqItems(
  boqId: string,
  orgId: string,
  rows: Parameters<typeof import("@/lib/queries/boq").bulkInsertBoqItems>[3],
  strategy: "append" | "replace" = "append"
): Promise<BulkBoqImportResult> {
  const actual =
    await vi.importActual<typeof import("@/lib/queries/boq")>(
      "@/lib/queries/boq"
    );
  return actual.bulkInsertBoqItems(boqId, orgId, strategy, rows);
}

const ORG = "org-test-001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkInsertBoqItems — source derivation", () => {
  it("uses CASE WHEN element_id IS NULL to set source per row", async () => {
    // Two rows: one whose itemCode matches a library element, one that
    // doesn't. Driven through the same INSERT statement, so we assert the
    // SQL embeds the CASE WHEN that flips between 'library' and 'custom'.
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // existing sections
      .mockResolvedValueOnce({
        // SELECT element by code — only LIB-1 exists
        rows: [{ id: "lib-element-id", code: "LIB-1" }],
      })
      .mockResolvedValueOnce({ rows: [] }) // SELECT max sort_order per section
      .mockResolvedValueOnce({ rows: [] }) // INSERT row 1 (LIB-1 → linked)
      .mockResolvedValueOnce({ rows: [] }) // INSERT row 2 (CUSTOM-1 → unlinked)
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await realBulkInsertBoqItems(BOQ_ID, ORG, [
      {
        rowNumber: 2,
        itemCode: "LIB-1",
        description: "Linked to library",
        unit: "m2",
        quantity: 5,
        unitCost: 10,
      },
      {
        rowNumber: 3,
        itemCode: "CUSTOM-1",
        description: "Custom row, no match",
        unit: "nos",
        quantity: 1,
        unitCost: 2.5,
      },
    ]);

    // Find the per-row INSERT calls (skip BEGIN, advisory lock, SELECTs).
    const inserts = mocks.db.query.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("INSERT INTO boq_item") &&
        c[0].includes("source")
    );
    expect(inserts.length).toBe(2);

    // SQL pins the source-derivation contract.
    expect(inserts[0]![0]).toContain(
      "CASE WHEN $3::uuid IS NULL THEN 'custom' ELSE 'library' END"
    );

    // Param $3 (element_id) is the lib id for the matched row, null otherwise.
    expect((inserts[0]![1] as unknown[])[2]).toBe("lib-element-id");
    expect((inserts[1]![1] as unknown[])[2]).toBeNull();
  });
});
