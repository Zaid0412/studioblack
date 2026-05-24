/**
 * `sent_to_client → client_reviewing` auto-bump.
 *
 * The bump runs inside `getBoq` whenever the BOQ route handler reports a
 * client viewer (`viewerIsClient: true`). Vendors are external but never
 * trigger it — they're not the approving party. This pins both behaviours.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getBoq, bumpSentToClientToReviewing } from "@/lib/queries/boq";
import { mocks } from "../setup";

const BOQ_ID = "boq-1";

function mockBoqRowOnce() {
  mocks.db.query.mockResolvedValueOnce({
    rows: [
      {
        id: BOQ_ID,
        project_id: "proj-1",
        title: "BOQ",
        version: 1,
        currency: "USD",
        exchange_rate: "1",
        contingency_pct: "5",
        vat_pct: "18",
        minimum_margin_pct: "10",
        client_id: null,
        architect_id: null,
        issued_date: null,
        approved_date: null,
        notes: null,
        client_notes: null,
        snapshot: null,
        created_by: "u-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ],
    rowCount: 1,
  });
  // sections / items / summary
  mocks.db.query
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    // summary aggregate row
    .mockResolvedValueOnce({
      rows: [
        {
          total_cost: "0",
          total_sell_price: "0",
          average_margin_pct: "0",
          margin_bleed_count: 0,
          pending_approvals: 0,
          over_budget_count: 0,
          item_count: 0,
        },
      ],
      rowCount: 1,
    })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

describe("bumpSentToClientToReviewing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues an UPDATE filtered to phase='sent_to_client' for this boq", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await bumpSentToClientToReviewing(BOQ_ID);
    expect(mocks.db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE boq_item/);
    expect(sql).toMatch(/SET phase = 'client_reviewing'/);
    expect(sql).toMatch(/phase = 'sent_to_client'/);
    expect(params).toEqual([BOQ_ID]);
  });
});

describe("getBoq — client_reviewing auto-bump", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires the bump as a CTE on the boq SELECT when viewerIsClient=true", async () => {
    mockBoqRowOnce();
    await getBoq(BOQ_ID, { viewerIsExternal: true, viewerIsClient: true });
    // The bump now piggybacks on the boq SELECT (first parallel query) as a
    // CTE — one round-trip instead of two. The regex matches the combined
    // statement: `WITH bump AS (UPDATE … client_reviewing …) SELECT b.* …`.
    const firstCall = mocks.db.query.mock.calls[0];
    expect(firstCall[0]).toMatch(
      /UPDATE boq_item[\s\S]*SET phase = 'client_reviewing'[\s\S]*SELECT b\.\*/
    );
  });

  it("does NOT fire the bump for vendor viewers (external, but viewerIsClient=false)", async () => {
    mockBoqRowOnce();
    await getBoq(BOQ_ID, { viewerIsExternal: true, viewerIsClient: false });
    // Every call must be a SELECT, never the bump UPDATE.
    for (const call of mocks.db.query.mock.calls) {
      expect(call[0]).not.toMatch(/UPDATE boq_item[\s\S]*client_reviewing/);
    }
  });

  it("does NOT fire the bump for studio (PM/architect) viewers", async () => {
    mockBoqRowOnce();
    await getBoq(BOQ_ID);
    for (const call of mocks.db.query.mock.calls) {
      expect(call[0]).not.toMatch(/UPDATE boq_item[\s\S]*client_reviewing/);
    }
  });
});
