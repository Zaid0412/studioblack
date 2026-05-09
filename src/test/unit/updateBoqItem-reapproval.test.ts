/**
 * Unit tests for `updateBoqItem`'s re-approval logic.
 *
 * Editing any field in `REAPPROVAL_FIELDS` on an `approved` BOQ item must
 * flip `client_approval_status` back to `pending` and set
 * `requires_reapproval = true`. This is a load-bearing decision (the client
 * literally signed off on certain values; changing them re-prompts).
 *
 * `clientRate` is in the set; `budgetRate` is NOT (internal-only).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UpdateBoqItemOutcome } from "@/lib/queries";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

const ITEM_ID = "550e8400-e29b-41d4-a716-446655440099";
const TOKEN = "2026-05-06T10:00:00.000Z";

async function realUpdateBoqItem(
  itemId: string,
  expectedUpdatedAt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any
): Promise<UpdateBoqItemOutcome> {
  const actual =
    await vi.importActual<typeof import("@/lib/queries/boq")>(
      "@/lib/queries/boq"
    );
  return actual.updateBoqItem(itemId, expectedUpdatedAt, input);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateBoqItem — re-approval flip on REAPPROVAL_FIELDS", () => {
  it("changing clientRate adds the requires_reapproval + pending flip clauses", async () => {
    // Single mocked SQL response — we only inspect the SQL string sent.
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ id: ITEM_ID }],
      rowCount: 1,
    });

    await realUpdateBoqItem(ITEM_ID, TOKEN, { clientRate: 999 });

    const sql = mocks.db.query.mock.calls[0]![0] as string;
    expect(sql).toContain("requires_reapproval");
    expect(sql).toContain("client_approval_status");
    expect(sql).toContain("'pending'");
  });

  it("changing budgetRate alone does NOT add the re-approval clauses (internal-only)", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ id: ITEM_ID }],
      rowCount: 1,
    });

    await realUpdateBoqItem(ITEM_ID, TOKEN, { budgetRate: 50 });

    const sql = mocks.db.query.mock.calls[0]![0] as string;
    expect(sql).not.toContain("requires_reapproval");
    expect(sql).not.toContain("'pending'");
  });

  it("explicit clientApprovalStatus skips the auto-flip (caller wins)", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ id: ITEM_ID }],
      rowCount: 1,
    });

    await realUpdateBoqItem(ITEM_ID, TOKEN, {
      clientRate: 999,
      clientApprovalStatus: "approved",
    });

    const sql = mocks.db.query.mock.calls[0]![0] as string;
    // The CASE-clause auto-flip is gone; the caller's value is set directly.
    expect(sql).not.toContain("requires_reapproval");
    expect(sql).toContain("client_approval_status");
  });

  it.each(["length", "breadth", "height"] as const)(
    "changing %s flips requires_reapproval + client_approval_status to pending",
    async (key) => {
      mocks.db.query.mockResolvedValueOnce({
        rows: [{ id: ITEM_ID }],
        rowCount: 1,
      });

      await realUpdateBoqItem(ITEM_ID, TOKEN, { [key]: 3 });

      const sql = mocks.db.query.mock.calls[0]![0] as string;
      expect(sql).toContain("requires_reapproval");
      expect(sql).toContain("client_approval_status");
      expect(sql).toContain("'pending'");
    }
  );
});
