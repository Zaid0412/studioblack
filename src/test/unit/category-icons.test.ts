import { describe, it, expect } from "vitest";
import { icons } from "lucide-react";
import {
  CURATED_CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICONS,
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
