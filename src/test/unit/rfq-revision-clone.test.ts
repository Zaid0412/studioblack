import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL cloneRfqAsRevision (imported by file path, bypassing the
// global `@/lib/queries` barrel mock) against a controllable pooled client, so
// we can assert the clone SQL: reuse base number + revision+1, link the parent,
// copy items and vendors, and retire the old RFQ to 'superseded'.
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

import { cloneRfqAsRevision } from "@/lib/queries/rfqs";
import { reviseRfqSchema, parseBody } from "@/lib/validations";

const OLD = {
  id: "old-rfq-1",
  org_id: "org-1",
  project_id: "proj-1",
  rfq_number: "RFQ-2026-0042",
  title: "Joinery",
  status: "issued",
  scope_of_work: "cabinets",
  terms_conditions: null,
  response_deadline: null,
  revision_number: 2,
};
const NEXT = { ...OLD, id: "new-rfq-1", status: "draft", revision_number: 3 };

/** Route client.query by SQL: FOR UPDATE → old row, INSERT rfq → new row. */
function wireHappyPath(oldRow = OLD) {
  mockClientQuery.mockImplementation((sql: string) => {
    if (/FOR UPDATE/.test(sql)) return Promise.resolve({ rows: [oldRow] });
    if (/INSERT INTO rfq \(/.test(sql))
      return Promise.resolve({ rows: [NEXT] });
    return Promise.resolve({ rows: [] });
  });
}

const sqlsOf = () => mockClientQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("cloneRfqAsRevision (RFQ-3b)", () => {
  it("clones into a draft revision that reuses the base number and links the parent", async () => {
    wireHappyPath();
    const res = await cloneRfqAsRevision("old-rfq-1", "user-pm");
    expect(res).toEqual({ ok: true, rfq: NEXT });

    const insertRfq = mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO rfq \(/.test(String(c[0]))
    );
    expect(insertRfq).toBeTruthy();
    const params = insertRfq![1] as unknown[];
    expect(params).toContain(OLD.rfq_number); // reuses base number
    expect(params).toContain(OLD.revision_number + 1); // revision +1
    expect(params).toContain(OLD.id); // supersedes_rfq_id
  });

  it("copies items + vendors and retires the old RFQ, all committed", async () => {
    wireHappyPath();
    await cloneRfqAsRevision("old-rfq-1", "user-pm");
    const sqls = sqlsOf();
    // Items are sourced from the live boq_item (RFQ-3c), not the stale snapshot.
    expect(
      sqls.some((s) => /INSERT INTO rfq_item[\s\S]*JOIN boq_item/.test(s))
    ).toBe(true);
    expect(
      sqls.some((s) => /INSERT INTO rfq_vendor[\s\S]*SELECT/.test(s))
    ).toBe(true);
    expect(sqls.some((s) => /status = 'superseded'/.test(s))).toBe(true);
    expect(sqls).toContain("BEGIN");
    expect(sqls).toContain("COMMIT");
  });

  it("persists the revision reason on the new draft when given (RFQ-3c)", async () => {
    wireHappyPath();
    await cloneRfqAsRevision(
      "old-rfq-1",
      "user-pm",
      "Client added two wardrobes"
    );
    const insertRfq = mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO rfq \(/.test(String(c[0]))
    );
    expect(String(insertRfq![0])).toMatch(/revision_reason/);
    expect(insertRfq![1]).toContain("Client added two wardrobes");
  });

  it("stores null revision reason when none is given", async () => {
    wireHappyPath();
    await cloneRfqAsRevision("old-rfq-1", "user-pm");
    const insertRfq = mockClientQuery.mock.calls.find((c) =>
      /INSERT INTO rfq \(/.test(String(c[0]))
    );
    // The reason param is the last positional value on the rfq insert.
    const params = insertRfq![1] as unknown[];
    expect(params[params.length - 1]).toBeNull();
  });

  it("refuses a draft (non-revisable) status and rolls back", async () => {
    wireHappyPath({ ...OLD, status: "draft" });
    const res = await cloneRfqAsRevision("old-rfq-1", "user-pm");
    expect(res).toEqual({ ok: false, reason: "wrong_status" });
    expect(sqlsOf()).toContain("ROLLBACK");
    // No new RFQ row inserted.
    expect(sqlsOf().some((s) => /INSERT INTO rfq \(/.test(s))).toBe(false);
  });

  it("returns not_found when the RFQ is gone", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/FOR UPDATE/.test(sql)) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    const res = await cloneRfqAsRevision("missing", "user-pm");
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("reviseRfqSchema", () => {
  it("accepts an empty body, a reason, and null", () => {
    expect(parseBody(reviseRfqSchema, {}).success).toBe(true);
    expect(parseBody(reviseRfqSchema, { reason: "scope grew" }).success).toBe(
      true
    );
    expect(parseBody(reviseRfqSchema, { reason: null }).success).toBe(true);
  });

  it("rejects a reason over 2000 chars", () => {
    expect(
      parseBody(reviseRfqSchema, { reason: "x".repeat(2001) }).success
    ).toBe(false);
  });
});
