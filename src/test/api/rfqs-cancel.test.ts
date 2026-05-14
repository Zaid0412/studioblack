/**
 * POST /api/projects/[id]/rfqs/[rfqId]/cancel — PM-only.
 *
 * Architect denied (the cancel action visibly affects external vendors;
 * matches the PM-only convention from rate_contract cancel).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  cancelRfq,
  getOrgRole,
  hasProjectAccess,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as POST_CANCEL } from "@/app/api/projects/[id]/rfqs/[rfqId]/cancel/route";
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

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });

const cancelledRfq: Rfq = {
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing",
  status: "cancelled",
  issued_date: "2026-05-14",
  response_deadline: null,
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  created_by: "user-test-001",
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(getOrgRole).mockResolvedValue("owner");
  vi.mocked(cancelRfq).mockResolvedValue({ ok: true, rfq: cancelledRfq });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/cancel", () => {
  it("PM can cancel", async () => {
    const res = await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: { reason: "client withdrew scope" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<Rfq>(res);
    expect(status).toBe(200);
    expect(body.status).toBe("cancelled");
  });

  it("logs RFQ_CANCELLED with the reason", async () => {
    await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: { reason: "scope withdrawn" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_CANCELLED,
        metadata: { reason: "scope withdrawn" },
      })
    );
  });

  it("architect cannot cancel", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    const res = await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: {},
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });

  it("409 when RFQ is already cancelled or awarded", async () => {
    vi.mocked(cancelRfq).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: {},
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 when RFQ disappeared", async () => {
    vi.mocked(cancelRfq).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: {},
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await POST_CANCEL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/cancel`, {
        method: "POST",
        body: {},
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });
});
