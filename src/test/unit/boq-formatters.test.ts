import { describe, it, expect } from "vitest";
import {
  convertDimensions,
  marginTier,
  phaseToVariant,
  phaseToLabel,
  formatCurrency,
  formatDimension,
  formatDimensions,
  formatFeetInches,
  formatQty,
  formatPct,
  parseDimensionValue,
  parseFeetInches,
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
    expect(phaseToVariant("internal_changes_requested")).toBe(
      "changes-requested"
    );
    expect(phaseToVariant("internally_approved")).toBe("approved-arch");
    expect(phaseToVariant("sent_to_client")).toBe("submitted");
    expect(phaseToVariant("client_reviewing")).toBe("in-review");
    expect(phaseToVariant("client_changes_requested")).toBe(
      "changes-requested"
    );
    expect(phaseToVariant("client_approved")).toBe("approved-client");
  });
});

describe("phaseToLabel", () => {
  it("renders the user-facing label for every phase", () => {
    expect(phaseToLabel("draft")).toBe("Draft");
    expect(phaseToLabel("internal_review")).toBe("Internal Review");
    expect(phaseToLabel("internal_changes_requested")).toBe(
      "Changes Requested"
    );
    expect(phaseToLabel("internally_approved")).toBe("Internally Approved");
    expect(phaseToLabel("sent_to_client")).toBe("Sent to Client");
    expect(phaseToLabel("client_reviewing")).toBe("Client Reviewing");
    expect(phaseToLabel("client_changes_requested")).toBe(
      "Client Changes Requested"
    );
    expect(phaseToLabel("client_approved")).toBe("Client Approved");
  });

  it("shortens client-side labels for client viewers", () => {
    expect(phaseToLabel("client_approved", "client")).toBe("Approved");
    expect(phaseToLabel("client_changes_requested", "client")).toBe(
      "Changes Requested"
    );
    expect(phaseToLabel("client_reviewing", "client")).toBe("Reviewing");
  });

  it("keeps studio labels for non-client viewers", () => {
    expect(phaseToLabel("client_approved", "pm")).toBe("Client Approved");
    expect(phaseToLabel("client_approved", "architect")).toBe(
      "Client Approved"
    );
    expect(phaseToLabel("client_approved", null)).toBe("Client Approved");
  });

  it("leaves studio-internal phases unchanged for clients", () => {
    expect(phaseToLabel("internal_review", "client")).toBe("Internal Review");
    expect(phaseToLabel("internally_approved", "client")).toBe(
      "Internally Approved"
    );
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
  it("renders all three metric dimensions with 2dp", () => {
    expect(formatDimensions("2.5", "1.5", "0.5")).toBe("2.50 × 1.50 × 0.50 m");
  });

  it("skips a blank height", () => {
    expect(formatDimensions("5", "3", null)).toBe("5.00 × 3.00 m");
  });

  it("skips blank length and breadth", () => {
    expect(formatDimensions(null, null, "4")).toBe("4.00 m");
  });

  it("returns null when nothing is set", () => {
    expect(formatDimensions(null, null, null)).toBeNull();
  });

  it("treats zero and negative as blank", () => {
    expect(formatDimensions("0", "0", "0")).toBeNull();
    expect(formatDimensions("-1", "2", "3")).toBe("2.00 × 3.00 m");
  });

  it("ignores non-numeric strings", () => {
    expect(formatDimensions("abc", "2", "3")).toBe("2.00 × 3.00 m");
  });

  it("renders feet+inches when unit is ft", () => {
    expect(formatDimensions("7.8333333", "4.9166667", "1.6666667", "ft")).toBe(
      `7'10" × 4'11" × 1'8"`
    );
  });
});

describe("parseFeetInches", () => {
  it("parses the canonical feet+inches form", () => {
    expect(parseFeetInches(`7'10"`)).toBeCloseTo(7.8333, 4);
  });

  it("accepts a missing inches mark", () => {
    expect(parseFeetInches(`7'10`)).toBeCloseTo(7.8333, 4);
  });

  it("accepts decimal inches", () => {
    expect(parseFeetInches(`7'10.5"`)).toBeCloseTo(7.875, 4);
    expect(parseFeetInches(`7'10.25"`)).toBeCloseTo(7.854, 3);
  });

  it("accepts inches-only and feet-only forms", () => {
    expect(parseFeetInches(`10"`)).toBeCloseTo(0.8333, 4);
    expect(parseFeetInches(`7'`)).toBe(7);
  });

  it("treats a plain number as feet", () => {
    expect(parseFeetInches("7")).toBe(7);
    expect(parseFeetInches("7.5")).toBe(7.5);
  });

  it("tolerates whitespace between feet and inches", () => {
    expect(parseFeetInches(`7' 10"`)).toBeCloseTo(7.8333, 4);
  });

  it("returns null on blank or garbage input", () => {
    expect(parseFeetInches("")).toBeNull();
    expect(parseFeetInches("not-a-dim")).toBeNull();
    expect(parseFeetInches(`'`)).toBeNull();
    expect(parseFeetInches(`"`)).toBeNull();
  });

  it("rejects negative components", () => {
    expect(parseFeetInches("-1")).toBeNull();
  });
});

describe("formatFeetInches", () => {
  it("renders whole inches without decimals", () => {
    expect(formatFeetInches(7 + 10 / 12)).toBe(`7'10"`);
  });

  it("trims trailing zeros on decimal inches", () => {
    expect(formatFeetInches(7 + 10.5 / 12)).toBe(`7'10.5"`);
    expect(formatFeetInches(7 + 10.25 / 12)).toBe(`7'10.25"`);
  });

  it("wraps overflowed inches into the next foot", () => {
    expect(formatFeetInches(7 + 13 / 12)).toBe(`8'1"`);
    expect(formatFeetInches(7 + 12 / 12)).toBe(`8'0"`);
  });

  it("renders 0 feet correctly", () => {
    expect(formatFeetInches(10 / 12)).toBe(`0'10"`);
  });

  it("renders whole feet with zero inches", () => {
    expect(formatFeetInches(7)).toBe(`7'0"`);
  });
});

describe("formatDimension (single value, by unit)", () => {
  it("renders metres with 2 decimal places", () => {
    expect(formatDimension("2.5", "m")).toBe("2.50");
    expect(formatDimension(0.5, "m")).toBe("0.50");
  });

  it("renders feet+inches for ft unit", () => {
    expect(formatDimension(7 + 10 / 12, "ft")).toBe(`7'10"`);
  });

  it("returns em-dash for null / zero", () => {
    expect(formatDimension(null, "m")).toBe("—");
    expect(formatDimension(0, "m")).toBe("—");
    expect(formatDimension("", "ft")).toBe("—");
  });
});

describe("parseDimensionValue", () => {
  it("parses a metric decimal", () => {
    expect(parseDimensionValue("2.5", "m")).toBe(2.5);
    expect(parseDimensionValue("0", "m")).toBe(0);
  });

  it("rejects garbage in metric mode", () => {
    expect(parseDimensionValue("abc", "m")).toBeNull();
    expect(parseDimensionValue("", "m")).toBeNull();
  });

  it("rejects negative metric input", () => {
    expect(parseDimensionValue("-1", "m")).toBeNull();
  });

  it("delegates to parseFeetInches in ft mode", () => {
    expect(parseDimensionValue(`7'10"`, "ft")).toBeCloseTo(7.8333, 4);
    expect(parseDimensionValue("12", "ft")).toBe(12);
    expect(parseDimensionValue("", "ft")).toBeNull();
  });
});

describe("convertDimensions", () => {
  it("returns the same values when from === to", () => {
    const out = convertDimensions("2.5", "1.5", "0.5", "m", "m");
    expect(out.length).toBe(2.5);
    expect(out.breadth).toBe(1.5);
    expect(out.height).toBe(0.5);
  });

  it("converts metres to feet", () => {
    const out = convertDimensions("2.5", "1.5", "0.5", "m", "ft");
    expect(out.length).toBeCloseTo(8.2021, 3);
    expect(out.breadth).toBeCloseTo(4.9213, 3);
    expect(out.height).toBeCloseTo(1.6404, 3);
  });

  it("converts feet to metres", () => {
    const out = convertDimensions("8.2021", "4.9213", "1.6404", "ft", "m");
    expect(out.length).toBeCloseTo(2.5, 2);
    expect(out.breadth).toBeCloseTo(1.5, 2);
    expect(out.height).toBeCloseTo(0.5, 2);
  });

  it("round-trips m -> ft -> m within 1e-3", () => {
    const toFt = convertDimensions("2.5", "1.5", "0.5", "m", "ft");
    const back = convertDimensions(
      String(toFt.length),
      String(toFt.breadth),
      String(toFt.height),
      "ft",
      "m"
    );
    expect(back.length).toBeCloseTo(2.5, 3);
    expect(back.breadth).toBeCloseTo(1.5, 3);
    expect(back.height).toBeCloseTo(0.5, 3);
  });

  it("passes blank inputs through as null", () => {
    const out = convertDimensions(null, "1.5", null, "m", "ft");
    expect(out.length).toBeNull();
    expect(out.height).toBeNull();
    expect(out.breadth).toBeCloseTo(4.9213, 3);
  });

  it("computes quantity as the positive-dim product", () => {
    const out = convertDimensions("2.5", "1.5", "0.5", "m", "m");
    expect(out.quantity).toBeCloseTo(1.875, 6);
  });

  it("returns null quantity when no dim is positive", () => {
    const out = convertDimensions(null, null, null, "m", "ft");
    expect(out.quantity).toBeNull();
  });
});
