/**
 * POST /api/projects/[id]/rfqs/[rfqId]/revise — pm/architect (RFQ-3b).
 * Clones the RFQ into a new draft revision and returns it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  cloneRfqAsRevision,
  hasProjectAccess,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as POST_REVISE } from "@/app/api/projects/[id]/rfqs/[rfqId]/revise/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { Rfq } from "@/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const REVISION_ID = "33333333-3333-4333-8333-333333333333";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });

const revisionRfq: Rfq = {
  id: REVISION_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing",
  status: "draft",
  issued_date: null,
  response_deadline: null,
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  revision_number: 1,
  supersedes_rfq_id: RFQ_ID,
  created_by: "user-test-001",
  created_at: "2026-05-20T00:00:00Z",
  updated_at: "2026-05-20T00:00:00Z",
};

const revise = (body: unknown, session = pmSession) => {
  setupAuth(mocks.auth, session);
  return POST_REVISE(
    buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/revise`, {
      method: "POST",
      body,
    }),
    buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(cloneRfqAsRevision).mockResolvedValue({
    ok: true,
    rfq: revisionRfq,
  });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/revise", () => {
  it("PM gets the new draft revision", async () => {
    const { status, body } = await parseResponse<Rfq>(
      await revise({ reason: "scope grew" })
    );
    expect(status).toBe(200);
    expect(body.id).toBe(REVISION_ID);
    expect(body.status).toBe("draft");
    expect(body.revision_number).toBe(1);
    expect(cloneRfqAsRevision).toHaveBeenCalledWith(
      RFQ_ID,
      "user-test-001",
      "scope grew"
    );
  });

  it("architect can also revise", async () => {
    const res = await revise({}, architectSession);
    expect(res.status).toBe(200);
  });

  it("logs RFQ_REVISED with the chain metadata + reason", async () => {
    await revise({ reason: "client added wardrobes" });
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_REVISED,
        targetId: REVISION_ID,
        metadata: {
          supersedes_rfq_id: RFQ_ID,
          revision_number: 1,
          reason: "client added wardrobes",
        },
      })
    );
  });

  it("409 when the RFQ is not in a revisable status", async () => {
    vi.mocked(cloneRfqAsRevision).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    expect((await revise({})).status).toBe(409);
  });

  it("404 when the RFQ disappeared", async () => {
    vi.mocked(cloneRfqAsRevision).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    expect((await revise({})).status).toBe(404);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await revise({});
    expect(res.status).toBe(404);
    expect(cloneRfqAsRevision).not.toHaveBeenCalled();
  });
});
