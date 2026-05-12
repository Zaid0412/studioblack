import { describe, it, expect } from "vitest";
import {
  marginTier,
  phaseToVariant,
  phaseToLabel,
  formatCurrency,
  formatDimensions,
  formatQty,
  formatPct,
  toNum,
} from "@/app/(dashboard)/projects/[id]/boq/_lib/formatters";

describe("marginTier", () => {
  it("returns error below the default 8% floor", () => {
    expect(marginTier(0)).toBe("error");
    expect(marginTier(5)).toBe("error");
    expect(marginTier(7.99)).toBe("error");
  });

  it("returns warning between floor and 15%", () => {
    expect(marginTier(8)).toBe("warning");
    expect(marginTier(12)).toBe("warning");
    expect(marginTier(14.99)).toBe("warning");
  });

  it("returns success at or above 15%", () => {
    expect(marginTier(15)).toBe("success");
    expect(marginTier(20)).toBe("success");
    expect(marginTier(100)).toBe("success");
  });

  it("honours a custom minimumMarginPct floor", () => {
    expect(marginTier(9, 10)).toBe("error");
    expect(marginTier(10, 10)).toBe("warning");
    expect(marginTier(15, 10)).toBe("success");
  });

  it("returns error for non-finite input", () => {
    expect(marginTier(NaN)).toBe("error");
    expect(marginTier(Infinity)).toBe("success");
  });
});

describe("phaseToVariant", () => {
  it("maps every phase to a badge variant", () => {
    expect(phaseToVariant("draft")).toBe("draft");
    expect(phaseToVariant("internal_review")).toBe("in-review");
    expect(phaseToVariant("internally_approved")).toBe("approved-arch");
    expect(phaseToVariant("submitted_to_client")).toBe("submitted");
    expect(phaseToVariant("client_approved")).toBe("approved-client");
    expect(phaseToVariant("change_requested")).toBe("changes-requested");
  });
});

describe("phaseToLabel", () => {
  it("renders title-case labels for every phase", () => {
    expect(phaseToLabel("draft")).toBe("Draft");
    expect(phaseToLabel("internal_review")).toBe("Internal Review");
    expect(phaseToLabel("internally_approved")).toBe("Internally Approved");
    expect(phaseToLabel("submitted_to_client")).toBe("Submitted to Client");
    expect(phaseToLabel("client_approved")).toBe("Client Approved");
    expect(phaseToLabel("change_requested")).toBe("Change Requested");
  });
});

describe("toNum", () => {
  it("parses numeric strings", () => {
    expect(toNum("12.5")).toBe(12.5);
    expect(toNum("0")).toBe(0);
  });

  it("passes numbers through", () => {
    expect(toNum(42)).toBe(42);
  });

  it("returns 0 for nullish / invalid input", () => {
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum("not-a-number")).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats USD with 2 fraction digits", () => {
    expect(formatCurrency("1234.5", "USD")).toContain("1,234.50");
  });

  it("handles invalid input as zero", () => {
    expect(formatCurrency(null as unknown as string, "USD")).toContain("0.00");
  });
});

describe("formatQty", () => {
  it("shows up to 3 fraction digits without forcing them", () => {
    expect(formatQty("10")).toBe("10");
    expect(formatQty("10.5")).toBe("10.5");
    expect(formatQty("10.123")).toBe("10.123");
  });
});

describe("formatPct", () => {
  it("fixes 1 decimal place", () => {
    expect(formatPct("12.345")).toBe("12.3%");
    expect(formatPct(0)).toBe("0.0%");
  });
});

describe("formatDimensions", () => {
  it("renders all three dimensions when present", () => {
    expect(formatDimensions("2.5", "1.5", "0.5")).toBe("2.5 × 1.5 × 0.5 m");
  });

  it("skips a blank height", () => {
    expect(formatDimensions("5", "3", null)).toBe("5 × 3 m");
  });

  it("skips blank length and breadth", () => {
    expect(formatDimensions(null, null, "4")).toBe("4 m");
  });

  it("returns null when nothing is set", () => {
    expect(formatDimensions(null, null, null)).toBeNull();
  });

  it("treats zero and negative as blank", () => {
    expect(formatDimensions("0", "0", "0")).toBeNull();
    expect(formatDimensions("-1", "2", "3")).toBe("2 × 3 m");
  });

  it("ignores non-numeric strings", () => {
    expect(formatDimensions("abc", "2", "3")).toBe("2 × 3 m");
  });
});
