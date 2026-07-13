import { describe, it, expect, vi, beforeEach } from "vitest";

// Execute the REAL boq query functions (imported by file path, bypassing the
// global `@/lib/queries` barrel mock) against a controllable pool, so we can
// assert the SQL/params they emit. Guards the load-bearing RFQ-3a invariant:
// a material edit snapshots the pre-edit row into boq_item_version, a trivial
// edit does not, and version diffs are computed against the next snapshot.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery, connect: vi.fn() }),
}));

import { updateBoqItem, getBoqItemVersions } from "@/lib/queries/boq";

const ORG_ID = "org-test-001";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440001";
const TOKEN = "2026-06-30T00:00:00.000Z";
const ACTOR = "user-pm";

beforeEach(() => {
  mockQuery.mockReset();
});

describe("updateBoqItem — change versioning (RFQ-3a)", () => {
  it("snapshots into boq_item_version on a material edit, with a derived reason", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_ID, quantity: 15 }] });

    await updateBoqItem(ITEM_ID, ORG_ID, TOKEN, { quantity: 15 }, ACTOR);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toContain("INSERT INTO boq_item_version");
    // versioning enabled + reason auto-derived from the quantity edit
    expect(params).toContain(true);
    expect(params).toContain("quantity");
    expect(params).toContain(ACTOR);
  });

  it("honours an explicit changeReason / changeNote over the derived one", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_ID }] });

    await updateBoqItem(
      ITEM_ID,
      ORG_ID,
      TOKEN,
      { quantity: 20, changeReason: "specification", changeNote: "extra unit" },
      ACTOR
    );

    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("specification");
    expect(params).toContain("extra unit");
    expect(params).not.toContain("quantity");
  });

  it("does NOT version a trivial (non-material) edit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_ID }] });

    await updateBoqItem(
      ITEM_ID,
      ORG_ID,
      TOKEN,
      { notes: "just a note" },
      ACTOR
    );

    const params = mockQuery.mock.calls[0][1] as unknown[];
    // shouldVersion=false and no reason string in the params
    expect(params).toContain(false);
    expect(params).not.toContain("quantity");
    expect(params).not.toContain("specification");
    expect(params).not.toContain("other");
  });

  it("flips client_approved AND ready_for_procurement back to sent_to_client on a material edit (RFQ-4a)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_ID, quantity: 15 }] });

    await updateBoqItem(ITEM_ID, ORG_ID, TOKEN, { quantity: 15 }, ACTOR);

    const sql = String(mockQuery.mock.calls[0][0]);
    // The re-open CASE must cover both terminal-ish phases, not just client_approved.
    expect(sql).toMatch(
      /phase = CASE WHEN bi\.phase IN \('client_approved','ready_for_procurement'\) THEN 'sent_to_client'/
    );
  });

  it("does NOT touch phase on a trivial (non-material) edit (RFQ-4a)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: ITEM_ID }] });

    await updateBoqItem(
      ITEM_ID,
      ORG_ID,
      TOKEN,
      { notes: "just a note" },
      ACTOR
    );

    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).not.toMatch(/phase = CASE/);
  });

  it("reports conflict vs not_found when 0 rows update", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // update matched nothing
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // row still exists
    const conflict = await updateBoqItem(
      ITEM_ID,
      ORG_ID,
      TOKEN,
      { quantity: 1 },
      ACTOR
    );
    expect(conflict).toEqual({ ok: false, reason: "conflict" });

    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // row gone
    const gone = await updateBoqItem(
      ITEM_ID,
      ORG_ID,
      TOKEN,
      { quantity: 1 },
      ACTOR
    );
    expect(gone).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("getBoqItemVersions — diff computation (RFQ-3a)", () => {
  it("returns versions newest-first, diffing each snapshot to the next (or live row)", async () => {
    // v1 → v2 changed quantity 10→15; v2 → current changed unit_cost 5→8.
    // Single round-trip: the live row rides on every version row as `current_row`.
    const currentRow = { quantity: 15, unit_cost: 8, description: "A" };
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "v1",
          version_number: 1,
          change_reason: "quantity",
          change_note: null,
          changed_by: ACTOR,
          changed_by_name: "Zaid",
          changed_at: "2026-06-01T00:00:00.000Z",
          snapshot: { quantity: 10, unit_cost: 5, description: "A" },
          current_row: currentRow,
        },
        {
          id: "v2",
          version_number: 2,
          change_reason: "other",
          change_note: "repriced",
          changed_by: ACTOR,
          changed_by_name: "Zaid",
          changed_at: "2026-06-02T00:00:00.000Z",
          snapshot: { quantity: 15, unit_cost: 5, description: "A" },
          current_row: currentRow,
        },
      ],
    });

    const versions = await getBoqItemVersions(ITEM_ID);

    expect(mockQuery).toHaveBeenCalledTimes(1); // single round-trip
    expect(versions.map((v) => v.version_number)).toEqual([2, 1]);
    // newest (v2): unit_cost 5 → 8
    expect(versions[0].changes).toEqual([
      { field: "Unit cost", from: 5, to: 8 },
    ]);
    // v1: quantity 10 → 15
    expect(versions[1].changes).toEqual([
      { field: "Quantity", from: 10, to: 15 },
    ]);
  });

  it("detects a text change between numeric-looking strings (no Number() coercion)", async () => {
    // "5" → "5.0" must register as a change; a numeric coercion would treat
    // both as 5 and hide it.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "v1",
          version_number: 1,
          change_reason: "specification",
          change_note: null,
          changed_by: ACTOR,
          changed_by_name: "Zaid",
          changed_at: "2026-06-01T00:00:00.000Z",
          snapshot: { description: "5", quantity: 1 },
          current_row: { description: "5.0", quantity: 1 },
        },
      ],
    });
    const versions = await getBoqItemVersions(ITEM_ID);
    expect(versions[0].changes).toEqual([
      { field: "Description", from: "5", to: "5.0" },
    ]);
  });

  it("returns [] when the item has no recorded versions", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getBoqItemVersions(ITEM_ID)).toEqual([]);
  });
});
