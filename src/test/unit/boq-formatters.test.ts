import { describe, it, expect } from "vitest";
import {
  marginTier,
  lifecycleToVariant,
  clientApprovalToVariant,
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

describe("lifecycleToVariant", () => {
  it("maps every lifecycle status to a badge variant", () => {
    expect(lifecycleToVariant("draft")).toBe("draft");
    expect(lifecycleToVariant("submitted")).toBe("submitted");
    expect(lifecycleToVariant("approved")).toBe("approved-arch");
    expect(lifecycleToVariant("rejected")).toBe("error");
    expect(lifecycleToVariant("queried")).toBe("in-review");
    expect(lifecycleToVariant("locked")).toBe("info");
    expect(lifecycleToVariant("change_order_pending")).toBe("warning");
    expect(lifecycleToVariant("superseded")).toBe("archived");
  });
});

describe("clientApprovalToVariant", () => {
  it("maps every client approval status to a badge variant", () => {
    expect(clientApprovalToVariant("pending")).toBe("draft");
    expect(clientApprovalToVariant("approved")).toBe("approved-client");
    expect(clientApprovalToVariant("rejected")).toBe("changes-requested");
    expect(clientApprovalToVariant("queried")).toBe("in-review");
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
