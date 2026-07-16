import { describe, it, expect } from "vitest";
import {
  CATEGORY_CODE_MAX,
  applyCase,
  codeSegmentOf,
  composeCategoryCode,
  dedupeSegment,
  maxSegmentLength,
  normalizeCodeSegment,
  suggestCodeSegment,
  UNCATEGORIZED_PREFIX,
} from "@/lib/categoryCode";

describe("suggestCodeSegment", () => {
  it("abbreviates the first word to the cap (the PRD examples)", () => {
    expect(suggestCodeSegment("Kitchen", 4)).toBe("KITC");
    expect(suggestCodeSegment("Cabinets", 4)).toBe("CABI");
    expect(suggestCodeSegment("Base Cabinets", 4)).toBe("BASE");
  });

  it("honors the max length", () => {
    expect(suggestCodeSegment("Kitchen", 3)).toBe("KIT");
    expect(suggestCodeSegment("Structural", 5)).toBe("STRUC");
  });

  it("uses only the first alphanumeric word and uppercases", () => {
    expect(suggestCodeSegment("  wall / ceiling ", 4)).toBe("WALL");
  });

  it("returns empty for an empty or symbol-only name", () => {
    expect(suggestCodeSegment("", 4)).toBe("");
    expect(suggestCodeSegment("--- ///", 4)).toBe("");
  });
});

describe("applyCase", () => {
  it("uppercases + strips when forced", () => {
    expect(applyCase("ba se!", true)).toBe("BASE");
  });
  it("preserves case (but still strips) when not forced", () => {
    expect(applyCase("baSe-1", false)).toBe("baSe1");
  });
});

describe("dedupeSegment", () => {
  it("returns the segment unchanged when unique", () => {
    expect(dedupeSegment("BASE", ["WALL", "TALL"], 5)).toBe("BASE");
  });

  it("appends an incrementing number on a collision (BASE → BASE2)", () => {
    expect(dedupeSegment("BASE", ["BASE"], 5)).toBe("BASE2");
    expect(dedupeSegment("BASE", ["BASE", "BASE2"], 5)).toBe("BASE3");
  });

  it("truncates the base so the numbered code still fits the cap", () => {
    expect(dedupeSegment("BASE", ["BASE"], 4)).toBe("BAS2");
  });

  it("compares case-insensitively", () => {
    expect(dedupeSegment("Base", ["BASE"], 5)).toBe("Base2");
  });
});

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

  // A parent with no room left has no valid segment, so the field blocks input
  // rather than letting one character through to a save the server rejects.
  it("floors at zero under an over-long parent", () => {
    expect(maxSegmentLength("A".repeat(CATEGORY_CODE_MAX))).toBe(0);
  });
});

describe("UNCATEGORIZED_PREFIX", () => {
  it("is what an element with no category codes under", () => {
    expect(UNCATEGORIZED_PREFIX).toBe("GEN");
  });
});
