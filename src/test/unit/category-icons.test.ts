import { describe, it, expect } from "vitest";
import { icons } from "lucide-react";
import {
  CURATED_CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICONS,
  humanizeIconName,
} from "@/components/elements/categoryIcons";

describe("category icon sets", () => {
  it("every curated icon name resolves to a Lucide icon", () => {
    for (const name of CURATED_CATEGORY_ICONS) {
      expect(icons[name as keyof typeof icons], name).toBeTruthy();
    }
  });

  it("every inline quick-pick is part of the curated set", () => {
    for (const name of DEFAULT_CATEGORY_ICONS) {
      expect(CURATED_CATEGORY_ICONS).toContain(name);
    }
  });

  it("keeps the inline quick-pick row compact", () => {
    expect(DEFAULT_CATEGORY_ICONS.length).toBeLessThanOrEqual(6);
  });
});

describe("humanizeIconName", () => {
  it.each([
    ["House", "House"],
    ["BrickWall", "Brick Wall"],
    ["PencilRuler", "Pencil Ruler"],
    ["ShowerHead", "Shower Head"],
    ["AirVent", "Air Vent"],
    // Trailing variant digit keeps its space.
    ["Building2", "Building 2"],
    ["Columns3", "Columns 3"],
    // NxN dimension token stays whole — no space around the inner "x".
    ["Grid2x2", "Grid 2x2"],
    ["Grid3x3", "Grid 3x3"],
  ])("%s → %s", (input, expected) => {
    expect(humanizeIconName(input)).toBe(expected);
  });

  it("humanizes every curated name without a dangling single digit", () => {
    for (const name of CURATED_CATEGORY_ICONS) {
      expect(humanizeIconName(name), name).not.toMatch(/x \d/);
    }
  });
});
