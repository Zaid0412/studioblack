import { describe, it, expect } from "vitest";
import {
  CATEGORY_CODE_MAX,
  codeSegmentOf,
  composeCategoryCode,
  maxSegmentLength,
  normalizeCodeSegment,
  UNCATEGORIZED_PREFIX,
} from "@/lib/categoryCode";

describe("normalizeCodeSegment", () => {
  it("uppercases", () => {
    expect(normalizeCodeSegment("base")).toBe("BASE");
  });

  it("strips everything that isn't A-Z or 0-9", () => {
    expect(normalizeCodeSegment("Base Cabinets!")).toBe("BASECABINETS");
    // A typed hyphen would otherwise forge a fake path level.
    expect(normalizeCodeSegment("CAB-BASE")).toBe("CABBASE");
  });

  it("keeps digits", () => {
    expect(normalizeCodeSegment("v2")).toBe("V2");
  });
});

describe("composeCategoryCode", () => {
  it("appends the segment to the parent's code", () => {
    expect(composeCategoryCode("KIT-CAB", "base")).toBe("KIT-CAB-BASE");
  });

  it("returns the bare segment for a top-level category", () => {
    expect(composeCategoryCode(null, "kit")).toBe("KIT");
    expect(composeCategoryCode("", "kit")).toBe("KIT");
    expect(composeCategoryCode(undefined, "kit")).toBe("KIT");
  });

  it("is empty when there is no segment — no trailing dash", () => {
    expect(composeCategoryCode("KIT-CAB", "")).toBe("");
    expect(composeCategoryCode("KIT-CAB", "  ")).toBe("");
  });
});

describe("codeSegmentOf", () => {
  it("strips the parent's code", () => {
    expect(codeSegmentOf("KIT-CAB-BASE", "KIT-CAB")).toBe("BASE");
  });

  it("returns the whole code for a top-level category", () => {
    expect(codeSegmentOf("KIT", null)).toBe("KIT");
  });

  // Rows hand-typed before composition was enforced may not sit under their
  // parent. Surface them whole rather than silently slicing off a prefix that
  // isn't there.
  it("returns the whole code when it doesn't sit under the parent", () => {
    expect(codeSegmentOf("WAL-PNT", "KIT-CAB")).toBe("WAL-PNT");
  });

  it("is empty for a category with no code", () => {
    expect(codeSegmentOf(null, "KIT")).toBe("");
    expect(codeSegmentOf("", "KIT")).toBe("");
  });

  it("round-trips with composeCategoryCode", () => {
    const full = composeCategoryCode("KIT-CAB", "BASE");
    expect(composeCategoryCode("KIT-CAB", codeSegmentOf(full, "KIT-CAB"))).toBe(
      full
    );
  });
});

describe("maxSegmentLength", () => {
  it("gives the whole budget to a top-level category", () => {
    expect(maxSegmentLength(null)).toBe(CATEGORY_CODE_MAX);
  });

  it("leaves room for the parent's code and the separator", () => {
    // "KIT-CAB" (7) + "-" (1) => 12 left of the 20-char column.
    expect(maxSegmentLength("KIT-CAB")).toBe(CATEGORY_CODE_MAX - 8);
  });

  it("never drops to zero, even under an over-long parent", () => {
    expect(maxSegmentLength("A".repeat(CATEGORY_CODE_MAX))).toBe(1);
  });
});

describe("UNCATEGORIZED_PREFIX", () => {
  it("is what an element with no category codes under", () => {
    expect(UNCATEGORIZED_PREFIX).toBe("GEN");
  });
});
