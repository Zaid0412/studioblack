import { describe, it, expect, vi } from "vitest";
import type { ElementCategory, ElementCategoryNode } from "@/types";

// Unmock queries so we test the real buildCategoryTree implementation
vi.unmock("@/lib/queries");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildCategoryTree } = await import("@/lib/queries");

const makeCategory = (
  overrides: Partial<ElementCategory> & { id: string; name: string; level: 1 | 2 | 3 }
): ElementCategory => ({
  parent_id: null,
  code_prefix: null,
  sort_order: 0,
  icon: null,
  color: null,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("buildCategoryTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it("returns a single root node", () => {
    const rows = [makeCategory({ id: "a", name: "Root", level: 1 })];
    const tree = buildCategoryTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Root");
    expect(tree[0].children).toEqual([]);
  });

  it("nests children under parent", () => {
    const rows = [
      makeCategory({ id: "a", name: "Root", level: 1 }),
      makeCategory({ id: "b", name: "Child", level: 2, parent_id: "a" }),
    ];
    const tree = buildCategoryTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("Child");
  });

  it("builds a 3-level tree", () => {
    const rows = [
      makeCategory({ id: "a", name: "L1", level: 1 }),
      makeCategory({ id: "b", name: "L2", level: 2, parent_id: "a" }),
      makeCategory({ id: "c", name: "L3", level: 3, parent_id: "b" }),
    ];
    const tree = buildCategoryTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe("L3");
  });

  it("handles multiple roots", () => {
    const rows = [
      makeCategory({ id: "a", name: "Root A", level: 1, sort_order: 0 }),
      makeCategory({ id: "b", name: "Root B", level: 1, sort_order: 1 }),
    ];
    const tree = buildCategoryTree(rows);

    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("Root A");
    expect(tree[1].name).toBe("Root B");
  });

  it("handles multiple children under one parent", () => {
    const rows = [
      makeCategory({ id: "a", name: "Root", level: 1 }),
      makeCategory({ id: "b", name: "Child 1", level: 2, parent_id: "a", sort_order: 0 }),
      makeCategory({ id: "c", name: "Child 2", level: 2, parent_id: "a", sort_order: 1 }),
    ];
    const tree = buildCategoryTree(rows);

    expect(tree[0].children).toHaveLength(2);
  });

  it("skips orphaned records (parent not in set)", () => {
    const rows = [
      makeCategory({ id: "a", name: "Root", level: 1 }),
      makeCategory({ id: "b", name: "Orphan", level: 2, parent_id: "nonexistent" }),
    ];
    const tree = buildCategoryTree(rows);

    // Orphan should not appear in root or under any node
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });

  it("preserves all fields on nodes", () => {
    const rows = [
      makeCategory({
        id: "a",
        name: "Finishes",
        level: 1,
        code_prefix: "FIN",
        icon: "paint",
        color: "#FF0000",
        is_active: false,
        sort_order: 5,
      }),
    ];
    const tree = buildCategoryTree(rows);
    const node: ElementCategoryNode = tree[0];

    expect(node.id).toBe("a");
    expect(node.code_prefix).toBe("FIN");
    expect(node.icon).toBe("paint");
    expect(node.color).toBe("#FF0000");
    expect(node.is_active).toBe(false);
    expect(node.sort_order).toBe(5);
    expect(node.children).toEqual([]);
  });
});
