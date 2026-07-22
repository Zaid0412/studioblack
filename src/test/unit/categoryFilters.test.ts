import { describe, it, expect } from "vitest";
import type { ElementCategoryNode } from "@/types";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  pruneCategoryTree,
  sortCategoryTree,
  type CategoryFilters,
} from "@/app/(dashboard)/categories/_lib/categoryFilters";

let seq = 0;
function node(
  name: string,
  level: 1 | 2 | 3,
  extra: Partial<ElementCategoryNode> = {}
): ElementCategoryNode {
  seq += 1;
  return {
    id: `n${seq}`,
    org_id: "org",
    name,
    parent_id: null,
    level,
    code_prefix: null,
    sort_order: 0,
    icon: null,
    color: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    element_count: 0,
    in_use: false,
    children: [],
    ...extra,
  };
}

/**
 * Kitchen › Cabinets › { Base Cabinets (in use, 3 el, newest), Wall Cabinets };
 * Lighting (in use, 2 el).
 */
function buildTree(): ElementCategoryNode[] {
  const base = node("Base Cabinets", 3, {
    code_prefix: "KIT-CAB-BASE",
    in_use: true,
    element_count: 3,
    updated_at: "2026-03-01T00:00:00.000Z",
  });
  const wall = node("Wall Cabinets", 3, { code_prefix: "KIT-CAB-WALL" });
  const cabinets = node("Cabinets", 2, {
    code_prefix: "KIT-CAB",
    children: [base, wall],
  });
  const kitchen = node("Kitchen", 1, {
    code_prefix: "KIT",
    children: [cabinets],
  });
  const lighting = node("Lighting", 1, {
    code_prefix: "LGT",
    in_use: true,
    element_count: 2,
    updated_at: "2026-02-01T00:00:00.000Z",
  });
  return [kitchen, lighting];
}

/** Flatten to names in visible (depth-first) order. */
function names(tree: ElementCategoryNode[]): string[] {
  return tree.flatMap((n) => [n.name, ...names(n.children)]);
}

const filters = (over: Partial<CategoryFilters>): CategoryFilters => ({
  ...EMPTY_FILTERS,
  ...over,
});

describe("hasActiveFilters", () => {
  it("is false for the empty filter", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("treats a whitespace-only search as inactive", () => {
    expect(hasActiveFilters(filters({ search: "   " }))).toBe(false);
  });

  it("is true when any facet is set", () => {
    expect(hasActiveFilters(filters({ search: "kit" }))).toBe(true);
    expect(hasActiveFilters(filters({ level: 2 }))).toBe(true);
    expect(hasActiveFilters(filters({ usage: "in-use" }))).toBe(true);
  });
});

describe("pruneCategoryTree", () => {
  it("returns the input untouched when no filter is active", () => {
    const tree = buildTree();
    expect(pruneCategoryTree(tree, EMPTY_FILTERS)).toBe(tree);
  });

  it("keeps a match's ancestors and drops non-matching siblings", () => {
    const out = pruneCategoryTree(buildTree(), filters({ search: "base" }));
    expect(names(out)).toEqual(["Kitchen", "Cabinets", "Base Cabinets"]);
  });

  it("matches on the code prefix too", () => {
    const out = pruneCategoryTree(buildTree(), filters({ search: "lgt" }));
    expect(names(out)).toEqual(["Lighting"]);
  });

  it("level filter keeps matching nodes + ancestors, prunes the rest", () => {
    const lvl3 = pruneCategoryTree(buildTree(), filters({ level: 3 }));
    expect(names(lvl3)).toEqual([
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
      "Wall Cabinets",
    ]);
    // A matched ancestor keeps only its kept descendants.
    const lvl1 = pruneCategoryTree(buildTree(), filters({ level: 1 }));
    expect(names(lvl1)).toEqual(["Kitchen", "Lighting"]);
  });

  it("usage=in-use keeps referenced nodes + ancestors (own-node semantics)", () => {
    const out = pruneCategoryTree(buildTree(), filters({ usage: "in-use" }));
    expect(names(out)).toEqual([
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
      "Lighting",
    ]);
  });

  it("usage=unused keeps only unreferenced nodes", () => {
    const out = pruneCategoryTree(buildTree(), filters({ usage: "unused" }));
    expect(names(out)).toEqual(["Kitchen", "Cabinets", "Wall Cabinets"]);
  });

  it("returns an empty tree when nothing matches", () => {
    expect(pruneCategoryTree(buildTree(), filters({ search: "zzz" }))).toEqual(
      []
    );
  });
});

describe("sortCategoryTree", () => {
  it("returns the input untouched when no field is set", () => {
    const tree = buildTree();
    expect(sortCategoryTree(tree, null, "asc")).toBe(tree);
  });

  it("sorts within each sibling group and preserves the hierarchy", () => {
    const out = sortCategoryTree(buildTree(), "name", "desc");
    expect(names(out)).toEqual([
      "Lighting",
      "Kitchen",
      "Cabinets",
      "Wall Cabinets",
      "Base Cabinets",
    ]);
  });

  it("does not mutate the input tree", () => {
    const tree = buildTree();
    sortCategoryTree(tree, "name", "desc");
    expect(names(tree)).toEqual([
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
      "Wall Cabinets",
      "Lighting",
    ]);
  });

  it("sorts by element count", () => {
    const out = sortCategoryTree(buildTree(), "elements", "desc");
    expect(names(out)).toEqual([
      "Lighting",
      "Kitchen",
      "Cabinets",
      "Base Cabinets",
      "Wall Cabinets",
    ]);
  });

  it("sorts by updated date", () => {
    const out = sortCategoryTree(buildTree(), "updated", "desc");
    expect(names(out).slice(0, 2)).toEqual(["Lighting", "Kitchen"]);
  });

  it("orders null code prefixes ahead of real ones ascending", () => {
    const tree = [
      node("Has code", 1, { code_prefix: "AAA" }),
      node("No code", 1, { code_prefix: null }),
    ];
    const out = sortCategoryTree(tree, "code", "asc");
    expect(names(out)).toEqual(["No code", "Has code"]);
  });
});
