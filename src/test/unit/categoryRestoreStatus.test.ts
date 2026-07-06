import { describe, it, expect } from "vitest";
import { computeRestoreStatus } from "@/app/(dashboard)/elements/_lib/categoryRestoreStatus";
import type { SeedCategory } from "@/lib/categoryTemplates";
import type { ElementCategoryNode } from "@/types";

const TAX: SeedCategory[] = [
  {
    name: "Kitchen",
    codePrefix: "KIT",
    icon: "",
    color: "",
    children: [
      {
        name: "Cabinets",
        codePrefix: "KIT-CAB",
        children: [
          { name: "Base", codePrefix: "KIT-CAB-BASE" },
          { name: "Wall", codePrefix: "KIT-CAB-WALL" },
        ],
      },
    ],
  },
  {
    name: "Flooring",
    codePrefix: "FLR",
    icon: "",
    color: "",
    children: [{ name: "Tiles", codePrefix: "FLR-TIL" }],
  },
];
// Kitchen subtree = 4 nodes (Kitchen, Cabinets, Base, Wall); Flooring = 2.

/** Minimal org node — the helper only reads `name` + `children`. */
function node(
  name: string,
  children: ElementCategoryNode[] = []
): ElementCategoryNode {
  return { name, children } as ElementCategoryNode;
}

describe("computeRestoreStatus", () => {
  it("reports everything missing for an empty tree", () => {
    const s = computeRestoreStatus([], TAX);
    expect(s.totalDefault).toBe(6);
    expect(s.totalMissing).toBe(6);
    expect(s.byCode.get("KIT")).toEqual({ total: 4, missing: 4 });
    expect(s.byCode.get("FLR")).toEqual({ total: 2, missing: 2 });
    expect(s.customTopLevel).toBe(0);
  });

  it("reports nothing missing when the tree matches the taxonomy", () => {
    const tree = [
      node("Kitchen", [node("Cabinets", [node("Base"), node("Wall")])]),
      node("Flooring", [node("Tiles")]),
    ];
    const s = computeRestoreStatus(tree, TAX);
    expect(s.totalMissing).toBe(0);
    expect(s.byCode.get("KIT")!.missing).toBe(0);
    expect(s.customTopLevel).toBe(0);
  });

  it("counts a missing leaf and a missing category subtree", () => {
    const tree = [
      node("Kitchen", [node("Cabinets", [node("Base")])]), // missing Wall
      // Flooring entirely absent
    ];
    const s = computeRestoreStatus(tree, TAX);
    expect(s.byCode.get("KIT")).toEqual({ total: 4, missing: 1 }); // Wall
    expect(s.byCode.get("FLR")).toEqual({ total: 2, missing: 2 }); // Tiles + Flooring
    expect(s.totalMissing).toBe(3);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const tree = [
      node(" kitchen ", [node("CABINETS", [node("base"), node("wall")])]),
      node("Flooring", [node("Tiles")]),
    ];
    expect(computeRestoreStatus(tree, TAX).totalMissing).toBe(0);
  });

  it("counts custom top-level categories not in the default set", () => {
    const tree = [
      node("Kitchen", [node("Cabinets", [node("Base"), node("Wall")])]),
      node("Flooring", [node("Tiles")]),
      node("My Custom Cat"),
      node("Another Custom"),
    ];
    const s = computeRestoreStatus(tree, TAX);
    expect(s.totalMissing).toBe(0);
    expect(s.customTopLevel).toBe(2);
  });
});
