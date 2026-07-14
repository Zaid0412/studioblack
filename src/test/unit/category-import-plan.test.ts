/**
 * The import is a diff, and the diff is the whole safety story: a category that
 * the sheet drops but that still has data hanging off it must be reported, not
 * deleted. `element_category.parent_id` is ON DELETE CASCADE, so dropping a
 * Category silently takes its Service Areas — and the elements hang off those.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mocks } from "../setup";

async function planCategoryImport(
  orgId: string,
  paths: { name: string; codePrefix: string | null }[][]
) {
  const actual = await vi.importActual<
    typeof import("@/lib/queries/categoryImport")
  >("@/lib/queries/categoryImport");
  return actual.planCategoryImport(orgId, paths);
}

const ORG = "org-test-001";

/** Kitchen › Cabinets › Base Cabinets, as it stands in the DB today. */
const EXISTING = [
  {
    id: "kit",
    name: "Kitchen",
    parent_id: null,
    level: 1,
    code_prefix: "KIT",
  },
  {
    id: "cab",
    name: "Cabinets",
    parent_id: "kit",
    level: 2,
    code_prefix: "KIT-CAB",
  },
  {
    id: "base",
    name: "Base Cabinets",
    parent_id: "cab",
    level: 3,
    code_prefix: "KIT-CAB-BASE",
  },
];

const node = (name: string, codePrefix: string | null) => ({
  name,
  codePrefix,
});

const KITCHEN_CHAIN = [
  node("Kitchen", "KIT"),
  node("Cabinets", "KIT-CAB"),
  node("Base Cabinets", "KIT-CAB-BASE"),
];

/** First query is the existing tree; second is the reference count. */
function givenTree(
  existing = EXISTING,
  references: { category_id: string; source: string; cnt: string }[] = []
) {
  mocks.db.query
    .mockResolvedValueOnce({ rows: existing })
    .mockResolvedValueOnce({ rows: references });
}

describe("planCategoryImport", () => {
  beforeEach(() => {
    mocks.db.query.mockReset();
  });

  it("does nothing when the sheet matches what's already there", async () => {
    givenTree();
    const plan = await planCategoryImport(ORG, [KITCHEN_CHAIN]);

    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it("creates the nodes the sheet adds", async () => {
    givenTree();
    const plan = await planCategoryImport(ORG, [
      KITCHEN_CHAIN,
      [
        node("Kitchen", "KIT"),
        node("Cabinets", "KIT-CAB"),
        node("Wall Cabinets", "KIT-CAB-WALL"),
      ],
    ]);

    expect(plan.creates).toEqual([
      {
        path: ["Kitchen", "Cabinets", "Wall Cabinets"],
        codePrefix: "KIT-CAB-WALL",
        level: 3,
      },
    ]);
    expect(plan.deletes).toHaveLength(0);
  });

  // Identity is the name path, so a changed code is an edit of the same node.
  it("updates a node whose code changed", async () => {
    givenTree();
    const plan = await planCategoryImport(ORG, [
      [
        node("Kitchen", "KIT"),
        node("Cabinets", "KIT-CAB"),
        node("Base Cabinets", "KIT-CAB-BSE"),
      ],
    ]);

    expect(plan.updates).toEqual([
      {
        id: "base",
        path: ["Kitchen", "Cabinets", "Base Cabinets"],
        codePrefix: "KIT-CAB-BSE",
        previousCodePrefix: "KIT-CAB-BASE",
      },
    ]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it("deletes a node the sheet drops when nothing points at it", async () => {
    givenTree();
    const plan = await planCategoryImport(ORG, [
      [node("Kitchen", "KIT"), node("Cabinets", "KIT-CAB")],
    ]);

    expect(plan.deletes.map((d) => d.id)).toEqual(["base"]);
    expect(plan.blocked).toHaveLength(0);
  });

  it("blocks a delete that still has elements under it", async () => {
    givenTree(EXISTING, [
      { category_id: "base", source: "elements", cnt: "3" },
      { category_id: "base", source: "rateContractItems", cnt: "1" },
    ]);
    const plan = await planCategoryImport(ORG, [
      [node("Kitchen", "KIT"), node("Cabinets", "KIT-CAB")],
    ]);

    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0].path).toEqual([
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
    ]);
    expect(plan.blocked[0].references.elements).toBe(3);
    expect(plan.blocked[0].references.rateContractItems).toBe(1);
  });

  /**
   * The doomed set is the whole subtree, not just the node the sheet named.
   * Dropping "Kitchen" cascades to Cabinets and Base Cabinets — and it is Base
   * Cabinets that the elements are actually filed under.
   */
  it("counts references against the descendants of a dropped Category", async () => {
    givenTree(EXISTING, [
      { category_id: "base", source: "elements", cnt: "2" },
    ]);
    const plan = await planCategoryImport(ORG, [
      [node("Lighting", "LGT"), node("Ambient", "LGT-AMB")],
    ]);

    // Everything goes, and the leaf's elements are what block it.
    expect(plan.deletes.map((d) => d.id).sort()).toEqual([
      "base",
      "cab",
      "kit",
    ]);
    expect(plan.blocked.map((b) => b.id)).toEqual(["base"]);
    expect(plan.creates.map((c) => c.path.join(" > "))).toEqual([
      "Lighting",
      "Lighting > Ambient",
    ]);
  });

  // The sheet names paths, not ids — matching has to be case-blind or a
  // capitalisation fix would read as "delete this and make a new one".
  it("matches names case-insensitively", async () => {
    givenTree();
    const plan = await planCategoryImport(ORG, [
      [
        node("KITCHEN", "KIT"),
        node("cabinets", "KIT-CAB"),
        node("base cabinets", "KIT-CAB-BASE"),
      ],
    ]);

    expect(plan.creates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });
});
