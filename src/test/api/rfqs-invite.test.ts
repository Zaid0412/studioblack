/**
 * POST /api/projects/[id]/rfqs/[rfqId]/invite — add more vendors to an
 * already-issued RFQ without changing status. Emails fire ONLY for newly
 * inserted invitees; re-inviting an existing vendor is a silent no-op.
 *
 * Pins:
 *   - Audit row written with the NEW vendor_ids only
 *   - Short-circuit (no audit, no emails) when all picks were already on the RFQ
 *   - 409 / 404 / 400 mapped correctly to inviteRfqVendors reasons
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  getProjectName,
  getRfqContactsForEmail,
  hasProjectAccess,
  inviteRfqVendors,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { sendRfqIssuedEmail } from "@/lib/email";
import { POST as POST_INVITE } from "@/app/api/projects/[id]/rfqs/[rfqId]/invite/route";
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
const VENDOR_ID_2 = "44444444-4444-4444-8444-444444444444";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const issuedRfq: Rfq = {
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-002",
  title: "Plumbing",
  status: "issued",
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

const flushFanOut = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(inviteRfqVendors).mockResolvedValue({
    ok: true,
    rfq: issuedRfq,
    addedVendorIds: [VENDOR_ID_2],
  });
  vi.mocked(getRfqContactsForEmail).mockResolvedValue([
    {
      vendorId: VENDOR_ID_2,
      vendorName: "Beta Co",
      contactId: "c2",
      contactName: "Bea",
      contactEmail: "bea@beta.test",
      contactUserId: null,
    },
  ]);
  vi.mocked(getProjectName).mockResolvedValue("Marina Tower");
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/invite", () => {
  it("invites new vendors and returns addedVendorCount + emails sent", async () => {
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID, VENDOR_ID_2] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{
      rfq: Rfq;
      addedVendorCount: number;
      invitedContactCount: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.addedVendorCount).toBe(1);
    expect(body.invitedContactCount).toBe(1);
    expect(body.rfq.status).toBe("issued");
  });

  it("scopes the email fan-out to NEW invitees only", async () => {
    await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID, VENDOR_ID_2] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(vi.mocked(getRfqContactsForEmail)).toHaveBeenCalledWith(RFQ_ID, [
      VENDOR_ID_2,
    ]);
    await flushFanOut();
    expect(vi.mocked(sendRfqIssuedEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendRfqIssuedEmail)).toHaveBeenCalledWith(
      "bea@beta.test",
      expect.objectContaining({ vendorName: "Beta Co" })
    );
  });

  it("logs RFQ_VENDORS_ADDED with vendor names + ids in metadata", async () => {
    await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID, VENDOR_ID_2] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_VENDORS_ADDED,
        targetTable: "rfq",
        targetId: RFQ_ID,
        metadata: expect.objectContaining({
          vendor_ids: [VENDOR_ID_2],
          vendor_names: ["Beta Co"],
          invited_contact_count: 1,
        }),
      })
    );
  });

  it("short-circuits with addedVendorCount=0 when all picks already invited", async () => {
    vi.mocked(inviteRfqVendors).mockResolvedValue({
      ok: true,
      rfq: issuedRfq,
      addedVendorIds: [],
    });
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{
      addedVendorCount: number;
      invitedContactCount: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.addedVendorCount).toBe(0);
    expect(body.invitedContactCount).toBe(0);
    // No emails, no audit row when nothing was actually added.
    expect(vi.mocked(getRfqContactsForEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(sendRfqIssuedEmail)).not.toHaveBeenCalled();
    expect(vi.mocked(logAuditSafe)).not.toHaveBeenCalled();
  });

  it("409 when RFQ is in a non-inviteable status (draft / awarded / cancelled)", async () => {
    vi.mocked(inviteRfqVendors).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 when the RFQ disappeared", async () => {
    vi.mocked(inviteRfqVendors).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("400 when a vendor is invalid for the org", async () => {
    vi.mocked(inviteRfqVendors).mockResolvedValue({
      ok: false,
      reason: "bad_vendors",
    });
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400 when vendorIds is empty (Zod min(1))", async () => {
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await POST_INVITE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/invite`, {
        method: "POST",
        body: { vendorIds: [VENDOR_ID] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});
