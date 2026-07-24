import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RFQ-4a: only BOQ items the PM has marked `ready_for_procurement` (and that
 * aren't already committed to an RFQ, i.e. `po_status = 'none'`) may enter an
 * RFQ. The gate lives inside `createRfqDraft` and `addRfqItems`, AFTER the
 * project-ownership check, so both entry points are covered.
 *
 * We run the REAL query fns (imported by file path, bypassing the global
 * `@/lib/queries` barrel mock) against a controllable pooled client and route
 * `client.query` by SQL shape:
 *   - project SELECT           → org row
 *   - ownership COUNT (JOIN boq)→ passes (belongs to project)
 *   - eligibility COUNT        → we vary the returned count to (not) match
 */
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

import { createRfqDraft, addRfqItems } from "@/lib/queries/rfqs";

const ITEMS = [
  { boqItemId: "boq-1", description: "Vanity", unit: "nos", quantity: 2 },
  { boqItemId: "boq-2", description: "Mirror", unit: "nos", quantity: 2 },
];

const sqlsOf = () => mockClientQuery.mock.calls.map((c) => String(c[0]));
const eligibilityCall = () =>
  mockClientQuery.mock.calls.find((c) => /AND phase = ANY/.test(String(c[0])));

/**
 * @param eligibleCount how many of the requested items the eligibility COUNT
 *   returns. Equal to ITEMS.length → gate passes; less → gate rejects.
 */
function wire(eligibleCount: number) {
  mockClientQuery.mockImplementation((sql: string) => {
    if (/SELECT org_id, project_number FROM project/.test(sql))
      return Promise.resolve({
        rows: [{ org_id: "org-1", project_number: "P2026-001" }],
      });
    // addRfqItems' rfq FOR UPDATE lookup (draft, same project).
    if (/FROM rfq r/.test(sql))
      return Promise.resolve({
        rows: [{ status: "draft", project_id: "proj-1", next_sort: 0 }],
      });
    // Ownership COUNT: all items belong to the project.
    if (/JOIN boq b/.test(sql))
      return Promise.resolve({ rows: [{ count: String(ITEMS.length) }] });
    // Eligibility COUNT.
    if (/phase = ANY/.test(sql))
      return Promise.resolve({ rows: [{ count: String(eligibleCount) }] });
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("createRfqDraft — RFQ-4a eligibility gate", () => {
  it("rejects when an item is not ready for procurement, and rolls back before inserting", async () => {
    wire(1); // only 1 of 2 items ready
    await expect(
      createRfqDraft("proj-1", "user-pm", {
        title: "Bathroom",
        scopeOfWork: null,
        termsConditions: null,
        responseDeadline: null,
        items: ITEMS,
      })
    ).rejects.toThrow(/not ready for procurement/i);

    expect(sqlsOf()).toContain("ROLLBACK");
    // No RFQ row created when the gate fails.
    expect(sqlsOf().some((s) => /INSERT INTO rfq \(/.test(s))).toBe(false);
  });

  it("scopes the eligibility check to ready_for_procurement + po_status none, over the requested ids", async () => {
    wire(1);
    await createRfqDraft("proj-1", "user-pm", {
      title: "Bathroom",
      scopeOfWork: null,
      termsConditions: null,
      responseDeadline: null,
      items: ITEMS,
    }).catch(() => {});

    const call = eligibilityCall();
    expect(call).toBeTruthy();
    const sql = String(call![0]);
    expect(sql).toMatch(/phase = ANY\(\$2::text\[\]\)/);
    expect(sql).toMatch(/po_status = 'none'/);
    expect(call![1]).toEqual([["boq-1", "boq-2"], ["ready_for_procurement"]]);
  });
});

describe("addRfqItems — RFQ-4a eligibility gate", () => {
  it("returns bad_items and rolls back when an item is not ready for procurement", async () => {
    wire(1); // only 1 of 2 items ready
    const res = await addRfqItems("rfq-1", ITEMS);
    expect(res).toEqual({ ok: false, reason: "bad_items" });
    expect(sqlsOf()).toContain("ROLLBACK");
    expect(sqlsOf().some((s) => /INSERT INTO rfq_item/.test(s))).toBe(false);
  });

  it("proceeds to insert when every item is ready for procurement", async () => {
    wire(ITEMS.length); // all ready
    const res = await addRfqItems("rfq-1", ITEMS);
    expect(res).toEqual({ ok: true, count: ITEMS.length });
    expect(sqlsOf()).toContain("COMMIT");
  });

  it("locks the RFQ row without GROUP BY (Postgres forbids FOR UPDATE + GROUP BY)", async () => {
    wire(ITEMS.length);
    await addRfqItems("rfq-1", ITEMS);
    // The status/next_sort lookup takes FOR UPDATE to serialise concurrent
    // adds; it must derive next_sort via a subquery, not a GROUP BY, or the
    // statement fails at runtime ("FOR UPDATE is not allowed with GROUP BY").
    const lockSql = sqlsOf().find(
      (s) => /FROM rfq r/.test(s) && /FOR UPDATE/.test(s)
    );
    expect(lockSql).toBeTruthy();
    expect(lockSql).not.toMatch(/GROUP BY/);
  });
});
