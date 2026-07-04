/**
 * POST /api/projects/[id]/rfqs/[rfqId]/sync-boq — pm/architect (RFQ-3c).
 * Pulls current BOQ quantities into a live RFQ's items.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  syncRfqItemsFromBoq,
  hasProjectAccess,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as POST_SYNC } from "@/app/api/projects/[id]/rfqs/[rfqId]/sync-boq/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });

const sync = (session = pmSession) => {
  setupAuth(mocks.auth, session);
  return POST_SYNC(
    buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/sync-boq`, {
      method: "POST",
      body: {},
    }),
    buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(syncRfqItemsFromBoq).mockResolvedValue({ ok: true, synced: 2 });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/sync-boq", () => {
  it("PM syncs and gets the count", async () => {
    const { status, body } = await parseResponse<{ synced: number }>(
      await sync()
    );
    expect(status).toBe(200);
    expect(body.synced).toBe(2);
    expect(syncRfqItemsFromBoq).toHaveBeenCalledWith(RFQ_ID);
  });

  it("architect can sync too", async () => {
    expect((await sync(architectSession)).status).toBe(200);
  });

  it("logs RFQ_SYNCED_FROM_BOQ with the count", async () => {
    await sync();
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_SYNCED_FROM_BOQ,
        metadata: { synced: 2 },
      })
    );
  });

  it("does not log when nothing changed", async () => {
    vi.mocked(syncRfqItemsFromBoq).mockResolvedValue({ ok: true, synced: 0 });
    await sync();
    expect(vi.mocked(logAuditSafe)).not.toHaveBeenCalled();
  });

  it("409 when the RFQ is not in-flight", async () => {
    vi.mocked(syncRfqItemsFromBoq).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    expect((await sync()).status).toBe(409);
  });

  it("404 when the RFQ is gone / cross-project", async () => {
    vi.mocked(syncRfqItemsFromBoq).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    expect((await sync()).status).toBe(404);

    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await sync();
    expect(res.status).toBe(404);
  });
});
