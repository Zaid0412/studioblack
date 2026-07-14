import { describe, it, expect } from "vitest";
import {
  buildCategoryIndex,
  flattenCategories,
  isServiceArea,
  parentCategoryOptions,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";
import { categoryNode as node } from "@/test/fixtures/categoryTree";

// Kitchen › Cabinets › Base Units, plus a second root with no children.
const TREE: ElementCategoryNode[] = [
  node("kit", "Kitchen", 1, [
    node("cab", "Cabinets", 2, [node("base", "Base Units", 3)]),
  ]),
  node("bth", "Bathroom", 1),
];

/**
 * The parents the generic "New Category" form may offer. Anything deeper would
 * let the user create a Service Area without realising which level they'd made
 * (a Sub-category parent), or pick a parent the server rejects outright (a
 * Service Area parent — level 3 is the floor).
 */
describe("parentCategoryOptions", () => {
  const options = flattenCategories(TREE);

  it("offers top-level Categories only", () => {
    expect(parentCategoryOptions(options).map((o) => o.id)).toEqual([
      "kit",
      "bth",
    ]);
  });

  it("excludes Sub-categories — picking one would create a Service Area", () => {
    expect(parentCategoryOptions(options).map((o) => o.id)).not.toContain(
      "cab"
    );
  });

  it("excludes Service Areas — the server rejects them as a parent", () => {
    const areas = options.filter((o) => isServiceArea(options, o.id));
    expect(areas).toHaveLength(1);
    expect(parentCategoryOptions(options).map((o) => o.id)).not.toContain(
      "base"
    );
  });

  it("is empty when the org has no categories yet", () => {
    expect(parentCategoryOptions(flattenCategories([]))).toEqual([]);
  });
});

describe("flattenCategories", () => {
  it("carries the node's own name and its path, not just the breadcrumb", () => {
    const base = flattenCategories(TREE).find((o) => o.id === "base");

    expect(base?.name).toBe("Base Units");
    expect(base?.label).toBe("Kitchen › Cabinets › Base Units");
    expect(base?.path).toEqual(["Kitchen", "Cabinets", "Base Units"]);
  });
});

/**
 * The index is the drill cursor: it answers "what list do I open to reveal this
 * node?", which is why a Category resolves to itself (open its Sub-categories)
 * rather than to nothing.
 */
describe("buildCategoryIndex", () => {
  const index = buildCategoryIndex(TREE);

  it("locates a Service Area under both its ancestors", () => {
    const loc = index.get("base");
    expect(loc?.category.id).toBe("kit");
    expect(loc?.sub?.id).toBe("cab");
    expect(loc?.depth).toBe(2);
  });

  it("resolves a Sub-category to itself, so a picker opens on its areas", () => {
    const loc = index.get("cab");
    expect(loc?.category.id).toBe("kit");
    expect(loc?.sub?.id).toBe("cab");
    expect(loc?.depth).toBe(1);
  });

  it("resolves a Category to itself, with no Sub-category above it", () => {
    const loc = index.get("kit");
    expect(loc?.category.id).toBe("kit");
    expect(loc?.sub).toBeNull();
    expect(loc?.depth).toBe(0);
  });

  it("has no entry for an id outside the tree — callers fall back to the root", () => {
    expect(index.get("deleted")).toBeUndefined();
  });
});
