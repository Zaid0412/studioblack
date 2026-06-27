import { describe, it, expect } from "vitest";
import { MASTER_TAXONOMY, type SeedNode } from "@/lib/categoryTemplates";

/** Visit every node in the seed tree. */
function walk(
  nodes: readonly SeedNode[],
  fn: (n: SeedNode, depth: number) => void,
  depth = 1
) {
  for (const n of nodes) {
    fn(n, depth);
    if (n.children) walk(n.children, fn, depth + 1);
  }
}

describe("MASTER_TAXONOMY seed", () => {
  it("has 14 top-level categories", () => {
    expect(MASTER_TAXONOMY).toHaveLength(14);
  });

  it("every node has a non-empty name and a code", () => {
    walk(MASTER_TAXONOMY, (n) => {
      expect(n.name.trim().length).toBeGreaterThan(0);
      expect(n.codePrefix && n.codePrefix.length).toBeTruthy();
    });
  });

  it("every code fits element_category.code_prefix (<= 20 chars)", () => {
    walk(MASTER_TAXONOMY, (n) => {
      expect((n.codePrefix ?? "").length).toBeLessThanOrEqual(20);
    });
  });

  it("child codes extend the parent code (KIT → KIT-CAB → KIT-CAB-BASE)", () => {
    for (const cat of MASTER_TAXONOMY) {
      for (const sub of cat.children ?? []) {
        expect(sub.codePrefix?.startsWith(`${cat.codePrefix}-`)).toBe(true);
        for (const svc of sub.children ?? []) {
          expect(svc.codePrefix?.startsWith(`${sub.codePrefix}-`)).toBe(true);
        }
      }
    }
  });

  it("is exactly 3 levels deep — service areas are leaves", () => {
    let maxDepth = 0;
    walk(MASTER_TAXONOMY, (_n, depth) => {
      maxDepth = Math.max(maxDepth, depth);
    });
    expect(maxDepth).toBe(3);
  });

  it("all codes are unique", () => {
    const codes: string[] = [];
    walk(MASTER_TAXONOMY, (n) => {
      if (n.codePrefix) codes.push(n.codePrefix);
    });
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every category has a valid hex colour and an icon", () => {
    for (const cat of MASTER_TAXONOMY) {
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cat.icon.length).toBeGreaterThan(0);
    }
  });
});
