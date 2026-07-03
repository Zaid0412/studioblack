/**
 * POST /api/projects/[id]/rfqs/[rfqId]/issue — flip draft to issued, fan out
 * emails to receives_rfq contacts.
 *
 * Pins:
 *   - 409 if already issued; 422 if no items; 400 on bad vendor list.
 *   - Audit row + invitedContactCount in response on success.
 *   - Email fan-out fired but does NOT block on SMTP failures (route still 200).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  getProjectName,
  getRfqContactsForEmail,
  hasProjectAccess,
  issueRfq,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { sendRfqIssuedEmail } from "@/lib/email";
import { POST as POST_ISSUE } from "@/app/api/projects/[id]/rfqs/[rfqId]/issue/route";
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
const VENDOR_ID = "33333333-3333-4333-8333-333333333333";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const issuedRfq: Rfq = {
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing",
  status: "issued",
  issued_date: "2026-05-14",
  response_deadline: "2026-05-30",
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  revision_number: 0,
  supersedes_rfq_id: null,
  created_by: "user-test-001",
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(issueRfq).mockResolvedValue({ ok: true, rfq: issuedRfq });
  vi.mocked(getRfqContactsForEmail).mockResolvedValue([
    {
      vendorId: VENDOR_ID,
      vendorName: "Acme",
      contactId: "c1",
      contactName: "Ada",
      contactEmail: "ada@acme.test",
      contactUserId: null,
    },
  ]);
  vi.mocked(getProjectName).mockResolvedValue("Marina Tower");
});

/** Wait a macrotask so the fire-and-forget email loop has a chance to run. */
const flushFanOut = () => new Promise((r) => setTimeout(r, 0));

describe("POST /api/projects/[id]/rfqs/[rfqId]/issue", () => {
  it("issues the RFQ and returns invitedContactCount", async () => {
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{
      rfq: Rfq;
      invitedContactCount: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.rfq.status).toBe("issued");
    expect(body.invitedContactCount).toBe(1);
  });

  it("fires sendRfqIssuedEmail for each receives_rfq contact", async () => {
    await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    await flushFanOut();
    expect(vi.mocked(sendRfqIssuedEmail)).toHaveBeenCalledWith(
      "ada@acme.test",
      expect.objectContaining({
        vendorName: "Acme",
        projectName: "Marina Tower",
        rfqNumber: "RFQ-2026-001",
      })
    );
  });

  it("still returns 200 even when an SMTP send rejects", async () => {
    vi.mocked(sendRfqIssuedEmail).mockRejectedValueOnce(new Error("smtp down"));
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(200);
  });

  it("logs RFQ_ISSUED with vendor_ids + invited_contact_count metadata", async () => {
    await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_ISSUED,
        metadata: expect.objectContaining({
          vendor_ids: [VENDOR_ID],
          invited_contact_count: 1,
        }),
      })
    );
  });

  it("409 when RFQ is not in draft", async () => {
    vi.mocked(issueRfq).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("422 when RFQ has no items", async () => {
    vi.mocked(issueRfq).mockResolvedValue({ ok: false, reason: "no_items" });
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(422);
  });

  it("400 when a vendor is invalid", async () => {
    vi.mocked(issueRfq).mockResolvedValue({
      ok: false,
      reason: "bad_vendors",
    });
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400 when vendorIds is empty (Zod min(1))", async () => {
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await POST_ISSUE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/issue`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});
