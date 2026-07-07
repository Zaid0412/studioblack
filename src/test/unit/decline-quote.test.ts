import { describe, it, expect, vi, beforeEach } from "vitest";
import { declineQuoteSchema } from "@/lib/validations";

// Execute the REAL declineQuote (by file path, bypassing the global barrel mock)
// against a controllable pooled client, to assert the §14 decline SQL.
const { mockClientQuery, mockRelease } = vi.hoisted(() => ({
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: () =>
      Promise.resolve({ query: mockClientQuery, release: mockRelease }),
    query: vi.fn(),
  }),
}));

import { declineQuote, submitOrUpdateQuote } from "@/lib/queries/quotes";
import type { SubmitQuoteInput } from "@/lib/queries/quotes";

const RFQ = {
  id: "rfq-1",
  status: "issued",
  org_id: "org-1",
  project_id: "proj-1",
  rfq_number: "RFQ-2026-001",
  title: "Plumbing",
  is_late_now: false,
};

/** Route client.query by SQL. `existingStatus` = the vendor's current quote. */
function wire(existingStatus: string | null) {
  mockClientQuery.mockImplementation((sql: string) => {
    if (/FROM rfq WHERE id/.test(sql)) return Promise.resolve({ rows: [RFQ] });
    if (/FROM rfq_vendor rv JOIN vendor/.test(sql))
      return Promise.resolve({ rows: [{ company_name: "Acme Co" }] });
    if (/FROM vendor_quote[\s\S]*is_current[\s\S]*FOR UPDATE/.test(sql))
      return Promise.resolve({
        rows: existingStatus
          ? [{ id: "q-old", status: existingStatus, version: 1 }]
          : [],
      });
    if (/INSERT INTO vendor_quote/.test(sql))
      return Promise.resolve({ rows: [{ id: "q-new", status: "declined" }] });
    return Promise.resolve({ rows: [] });
  });
}

const sqlsOf = () => mockClientQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("declineQuoteSchema", () => {
  it("accepts a reason or nothing", () => {
    expect(declineQuoteSchema.safeParse({}).success).toBe(true);
    expect(declineQuoteSchema.safeParse({ reason: "too busy" }).success).toBe(
      true
    );
    expect(declineQuoteSchema.safeParse({ reason: null }).success).toBe(true);
  });
  it("rejects an over-long reason", () => {
    expect(
      declineQuoteSchema.safeParse({ reason: "x".repeat(2001) }).success
    ).toBe(false);
  });
});

describe("declineQuote (§14)", () => {
  it("inserts a declined quote with NO line items", async () => {
    wire(null);
    const res = await declineQuote("rfq-1", "vendor-1", {
      responseSource: "portal",
      reason: "no capacity",
    });
    expect(res).toMatchObject({ ok: true, vendorName: "Acme Co" });

    const sqls = sqlsOf();
    const insert = sqls.find((s) => /INSERT INTO vendor_quote/.test(s));
    expect(insert).toMatch(/'declined'/);
    // A decline carries no bid — never touches vendor_quote_item.
    expect(sqls.some((s) => /INSERT INTO vendor_quote_item/.test(s))).toBe(
      false
    );
    expect(sqls).toContain("BEGIN");
    expect(sqls).toContain("COMMIT");
  });

  it("retires an existing submitted quote before inserting the decline", async () => {
    wire("submitted");
    await declineQuote("rfq-1", "vendor-1", { responseSource: "portal" });
    expect(
      sqlsOf().some((s) => /UPDATE vendor_quote SET is_current = false/.test(s))
    ).toBe(true);
  });

  it("locks a decided quote (awarded) — cannot decline", async () => {
    wire("awarded");
    const res = await declineQuote("rfq-1", "vendor-1", {});
    expect(res).toEqual({ ok: false, reason: "quote_locked" });
    expect(sqlsOf()).toContain("ROLLBACK");
    expect(sqlsOf().some((s) => /INSERT INTO vendor_quote/.test(s))).toBe(
      false
    );
  });
});

describe("submitOrUpdateQuote — §14 un-decline", () => {
  function wireSubmit(existingStatus: string | null) {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/FROM rfq WHERE id/.test(sql))
        return Promise.resolve({
          rows: [
            {
              id: "rfq-1",
              status: "issued",
              response_deadline: null,
              org_id: "o",
              project_id: "p",
              rfq_number: "R",
              title: "T",
              is_late_now: false,
            },
          ],
        });
      if (/SELECT EXISTS/.test(sql))
        return Promise.resolve({ rows: [{ exists: true }] });
      if (/FROM rfq_item WHERE rfq_id/.test(sql))
        return Promise.resolve({ rows: [{ id: "item-1" }] });
      if (/FROM vendor_quote[\s\S]*is_current[\s\S]*FOR UPDATE/.test(sql))
        return Promise.resolve({
          rows: existingStatus
            ? [
                {
                  id: "q-old",
                  status: existingStatus,
                  version: 1,
                  attachments: null,
                },
              ]
            : [],
        });
      if (/INSERT INTO vendor_quote /.test(sql))
        return Promise.resolve({
          rows: [{ id: "q-new", currency: "USD", is_late: false }],
        });
      return Promise.resolve({ rows: [] });
    });
  }
  const input: SubmitQuoteInput = {
    items: [{ rfqItemId: "item-1", unitPrice: 100 }],
  } as SubmitQuoteInput;

  it("submitting over a DECLINED quote counts as new (un-decline), not a revision", async () => {
    wireSubmit("declined");
    const res = await submitOrUpdateQuote("rfq-1", "v-1", input, {
      responseSource: "portal",
    });
    expect(res).toMatchObject({ ok: true, isNew: true });
  });

  it("revising a SUBMITTED quote is not new", async () => {
    wireSubmit("submitted");
    const res = await submitOrUpdateQuote("rfq-1", "v-1", input, {
      responseSource: "portal",
    });
    expect(res).toMatchObject({ ok: true, isNew: false });
  });
});
