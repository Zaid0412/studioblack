/**
 * Tests for the level-batched `bulkCreateCategoriesFromTemplates`. Inserts are
 * batched one multi-row INSERT per depth (not one per node), while preserving
 * idempotency (skip names that already exist under the same parent), sort_order
 * continuation, and transactional rollback. The connected client shares the
 * `mocks.db.query` mock, so responses are sequenced in call order.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BulkCategoryNode } from "@/lib/validations";
import { mocks } from "../setup";

// `@/lib/queries` is globally mocked in setup — load the real implementation.
async function bulkCreateCategoriesFromTemplates(
  orgId: string,
  templates: readonly BulkCategoryNode[]
) {
  const actual = await vi.importActual<
    typeof import("@/lib/queries/elementCategories")
  >("@/lib/queries/elementCategories");
  return actual.bulkCreateCategoriesFromTemplates(orgId, templates);
}

const ORG = "org-test-001";

const kitchenTree: BulkCategoryNode[] = [
  {
    name: "Kitchen",
    codePrefix: "KIT",
    icon: "ChefHat",
    color: "#f59e0b",
    children: [
      {
        name: "Cabinets",
        codePrefix: "KIT-CAB",
        children: [
          { name: "Base Cabinets", codePrefix: "KIT-CAB-BASE" },
          { name: "Wall Cabinets", codePrefix: "KIT-CAB-WALL" },
        ],
      },
    ],
  },
];

const insertCalls = () =>
  mocks.db.query.mock.calls.filter(
    (c) =>
      typeof c[0] === "string" && c[0].includes("INSERT INTO element_category")
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkCreateCategoriesFromTemplates — level batching", () => {
  it("inserts a 3-level tree with one INSERT per level", async () => {
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing (none)
      .mockResolvedValueOnce({ rows: [{ id: "kit", name: "Kitchen" }] }) // L1
      .mockResolvedValueOnce({
        rows: [{ id: "cab", name: "Cabinets", parent_id: "kit" }],
      }) // L2
      .mockResolvedValueOnce({
        rows: [
          { id: "base", name: "Base Cabinets", parent_id: "cab" },
          { id: "wall", name: "Wall Cabinets", parent_id: "cab" },
        ],
      }) // L3
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const { created, skipped } = await bulkCreateCategoriesFromTemplates(
      ORG,
      kitchenTree
    );

    expect(created.map((c) => c.name)).toEqual([
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
      "Wall Cabinets",
    ]);
    expect(skipped).toEqual([]);

    const inserts = insertCalls();
    expect(inserts).toHaveLength(3); // one batch per depth, not 4 per-node
    // Level-3 batch carries both leaves in a single statement (8 params × 2).
    expect((inserts[2]![1] as unknown[]).length).toBe(16);

    const verbs = mocks.db.query.mock.calls.map((c) => c[0]);
    expect(verbs).toContain("BEGIN");
    expect(verbs).toContain("COMMIT");
  });

  it("skips names that already exist and only inserts the missing leaf", async () => {
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: "kit", name: "Kitchen", parent_id: null, sort_order: 0 },
          { id: "cab", name: "Cabinets", parent_id: "kit", sort_order: 0 },
        ],
      }) // SELECT existing
      .mockResolvedValueOnce({
        rows: [{ id: "base", name: "Base Cabinets", parent_id: "cab" }],
      }) // L3 insert (only missing node)
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const { created, skipped } = await bulkCreateCategoriesFromTemplates(ORG, [
      {
        name: "Kitchen",
        children: [
          { name: "Cabinets", children: [{ name: "Base Cabinets" }] },
        ],
      },
    ]);

    expect(created.map((c) => c.name)).toEqual(["Base Cabinets"]);
    expect(skipped).toEqual(["Kitchen", "Kitchen / Cabinets"]);
    // Levels 1 & 2 were fully satisfied by existing rows → no INSERT for them.
    expect(insertCalls()).toHaveLength(1);
  });

  it("continues sort_order from the existing max sibling", async () => {
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "a", name: "Alpha", parent_id: null, sort_order: 4 }],
      }) // SELECT existing
      .mockResolvedValueOnce({ rows: [{ id: "b", name: "Beta" }] }) // L1 insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await bulkCreateCategoriesFromTemplates(ORG, [{ name: "Beta" }]);

    // Params: orgId, name, parentId, level, codePrefix, sort_order, icon, color
    const values = insertCalls()[0]![1] as unknown[];
    expect(values[5]).toBe(5); // max existing (4) + 1
  });

  it("rolls back when an insert fails", async () => {
    mocks.db.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing
      .mockRejectedValueOnce(new Error("boom")) // L1 insert fails
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      bulkCreateCategoriesFromTemplates(ORG, [{ name: "X" }])
    ).rejects.toThrow("boom");

    expect(mocks.db.query.mock.calls.map((c) => c[0])).toContain("ROLLBACK");
  });
});
