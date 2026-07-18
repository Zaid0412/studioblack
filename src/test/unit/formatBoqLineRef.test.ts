import { describe, it, expect } from "vitest";
import { formatBoqLineRef } from "@/lib/boq/lineRef";

describe("formatBoqLineRef", () => {
  it("joins the division code to the line number", () => {
    expect(formatBoqLineRef("PLB", 20)).toBe("PLB-20");
    expect(formatBoqLineRef("GEN", 10)).toBe("GEN-10");
  });

  it("trims a padded code", () => {
    expect(formatBoqLineRef("  ELE  ", 30)).toBe("ELE-30");
  });

  it("falls back to the bare number when the code is absent", () => {
    expect(formatBoqLineRef(null, 40)).toBe("40");
    expect(formatBoqLineRef(undefined, 40)).toBe("40");
    expect(formatBoqLineRef("", 40)).toBe("40");
    expect(formatBoqLineRef("   ", 40)).toBe("40");
  });
});
