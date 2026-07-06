import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL issueRfq (by file path, bypassing the global @/lib/queries
// barrel mock) against a controllable pooled client, so we can assert the §11
// distribution-method stamping SQL on the rfq_vendor insert.
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

import { issueRfq } from "@/lib/queries/rfqs";

const DRAFT = {
  id: "rfq-1",
  org_id: "org-1",
  status: "draft",
  supersedes_rfq_id: null,
  rfq_number: "RFQ-2026-0001",
};
const ISSUED = { ...DRAFT, status: "issued" };

/** Route client.query by SQL so the real transaction runs to COMMIT. */
function wireHappyPath() {
  mockClientQuery.mockImplementation((sql: string) => {
    if (/FOR UPDATE/.test(sql)) return Promise.resolve({ rows: [DRAFT] });
    if (/COUNT\(\*\)[\s\S]*FROM rfq_item/.test(sql))
      return Promise.resolve({ rows: [{ count: "2" }] });
    if (/COUNT\(\*\)[\s\S]*FROM vendor\b/.test(sql))
      return Promise.resolve({ rows: [{ count: "1" }] });
    if (/UPDATE rfq[\s\S]*issued/.test(sql))
      return Promise.resolve({ rows: [ISSUED] });
    if (/INSERT INTO rfq_vendor/.test(sql))
      return Promise.resolve({ rows: [{ vendor_id: "vendor-1" }] });
    return Promise.resolve({ rows: [] });
  });
}

const sqlsOf = () => mockClientQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("issueRfq — §11 distribution stamping", () => {
  it("stamps distribution_method per vendor from receives_rfq contacts", async () => {
    wireHappyPath();
    const res = await issueRfq("rfq-1", ["vendor-1"], "user-pm");
    expect(res).toEqual({ ok: true, rfq: ISSUED });

    const insert = sqlsOf().find((s) => /INSERT INTO rfq_vendor/.test(s));
    expect(insert).toBeTruthy();
    // Column is written…
    expect(insert).toMatch(/distribution_method/);
    // …and derived: `email` when a receives_rfq contact exists, else `portal`.
    expect(insert).toMatch(/receives_rfq/);
    expect(insert).toMatch(/'email'/);
    expect(insert).toMatch(/'portal'/);

    const sqls = sqlsOf();
    expect(sqls).toContain("BEGIN");
    expect(sqls).toContain("COMMIT");
  });

  it("rolls back without inserting invites when the RFQ isn't draft", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/FOR UPDATE/.test(sql))
        return Promise.resolve({ rows: [{ ...DRAFT, status: "issued" }] });
      return Promise.resolve({ rows: [] });
    });
    const res = await issueRfq("rfq-1", ["vendor-1"], "user-pm");
    expect(res).toEqual({ ok: false, reason: "wrong_status" });
    expect(sqlsOf().some((s) => /INSERT INTO rfq_vendor/.test(s))).toBe(false);
    expect(sqlsOf()).toContain("ROLLBACK");
  });
});
