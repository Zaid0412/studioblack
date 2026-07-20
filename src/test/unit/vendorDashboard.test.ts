/**
 * Win-rate derivation for the vendor dashboard. Imported from the module path
 * (not the `@/lib/queries` barrel, which setup.ts auto-mocks) so the real pure
 * helper runs.
 */
import { describe, it, expect } from "vitest";
import { winRateFromOutcomes } from "@/lib/queries/vendorDashboard";
import type { VendorQuoteOutcome } from "@/types";

const outcomes = (m: Partial<Record<string, number>>): VendorQuoteOutcome[] =>
  Object.entries(m).map(([status, count]) => ({ status, count: count! }));

describe("winRateFromOutcomes", () => {
  it("is 0 when nothing has been decided", () => {
    expect(winRateFromOutcomes([])).toBe(0);
    expect(
      winRateFromOutcomes(outcomes({ submitted: 3, under_review: 2 }))
    ).toBe(0);
  });

  it("counts awarded over all decided quotes", () => {
    expect(winRateFromOutcomes(outcomes({ awarded: 3, rejected: 1 }))).toBe(75);
  });

  it("folds declined and expired into the denominator", () => {
    expect(
      winRateFromOutcomes(
        outcomes({ awarded: 1, rejected: 1, declined: 1, expired: 1 })
      )
    ).toBe(25);
  });

  it("ignores non-decided buckets in the denominator", () => {
    // 2 awarded / (2 awarded + 2 rejected) = 50%; submitted/under_review excluded.
    expect(
      winRateFromOutcomes(
        outcomes({ awarded: 2, rejected: 2, submitted: 5, under_review: 3 })
      )
    ).toBe(50);
  });

  it("rounds to the nearest integer percent", () => {
    // 1 / 3 = 33.33 → 33
    expect(winRateFromOutcomes(outcomes({ awarded: 1, rejected: 2 }))).toBe(33);
  });
});
