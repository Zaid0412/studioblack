import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL query functions (imported by file path, bypassing the global
// `@/lib/queries` barrel mock) against a controllable pool, so we can assert the
// SQL they emit. This guards the load-bearing invariant of quote versioning:
// every current-quote read must scope to `is_current`, or superseded history
// rows would leak into the list / comparison / portal view. A future edit that
// drops the filter from any of these reads fails here.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery, connect: vi.fn() }),
}));

import {
  getQuotesByRfq,
  getQuoteComparison,
  getQuoteForVendor,
} from "@/lib/queries/quotes";

/** SQL SELECTs that read the `vendor_quote` table (not `vendor_quote_item`). */
function vendorQuoteSelects(calls: unknown[][]): string[] {
  return calls
    .map((c) => String(c[0]))
    .filter(
      (sql) => /select/i.test(sql) && /\bvendor_quote\b(?!_item)/.test(sql)
    );
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

describe("current-quote reads scope to is_current (versioning guard)", () => {
  it("getQuotesByRfq filters is_current on every vendor_quote read", async () => {
    await getQuotesByRfq("rfq-1");
    const selects = vendorQuoteSelects(mockQuery.mock.calls);
    expect(selects.length).toBeGreaterThan(0);
    for (const sql of selects) expect(sql).toMatch(/is_current/);
  });

  it("getQuoteComparison filters is_current on every vendor_quote read", async () => {
    await getQuoteComparison("rfq-1");
    const selects = vendorQuoteSelects(mockQuery.mock.calls);
    expect(selects.length).toBeGreaterThan(0);
    for (const sql of selects) expect(sql).toMatch(/is_current/);
  });

  it("getQuoteForVendor filters is_current on the vendor's quote read", async () => {
    await getQuoteForVendor("rfq-1", "vendor-1");
    const selects = vendorQuoteSelects(mockQuery.mock.calls);
    expect(selects.length).toBeGreaterThan(0);
    for (const sql of selects) expect(sql).toMatch(/is_current/);
  });
});
