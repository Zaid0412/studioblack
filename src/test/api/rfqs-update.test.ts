/**
 * PATCH /api/projects/[id]/rfqs/[rfqId] — header-only edit while in draft.
 *
 * Pins the 409 once status leaves `draft` — rewriting scope after vendors
 * have seen it would silently change what they were asked to bid on.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasProjectAccess,
  updateRfqDraft,
  verifyRfqOwnership,
} from "@/lib/queries";
import { PATCH as PATCH_RFQ } from "@/app/api/projects/[id]/rfqs/[rfqId]/route";
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

const sampleRfq: Rfq = {
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Edited title",
  status: "draft",
  issued_date: null,
  response_deadline: null,
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: "new scope",
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
  vi.mocked(updateRfqDraft).mockResolvedValue({ ok: true, row: sampleRfq });
});

describe("PATCH /api/projects/[id]/rfqs/[rfqId]", () => {
  it("updates a draft RFQ for PM", async () => {
    const res = await PATCH_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`, {
        method: "PATCH",
        body: { title: "Edited title", scopeOfWork: "new scope" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<Rfq>(res);
    expect(status).toBe(200);
    expect(body.title).toBe("Edited title");
  });

  it("409 when RFQ is awarded or cancelled", async () => {
    // Edits are now allowed post-issue; only awarded/cancelled terminate
    // the header lifecycle and surface wrong_status from updateRfqDraft.
    vi.mocked(updateRfqDraft).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await PATCH_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`, {
        method: "PATCH",
        body: { title: "after award" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 when the RFQ disappeared between ownership check and update", async () => {
    vi.mocked(updateRfqDraft).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await PATCH_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`, {
        method: "PATCH",
        body: { title: "x" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("400 when the body has no fields", async () => {
    const res = await PATCH_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`, {
        method: "PATCH",
        body: {},
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("404 when rfqId belongs to a different project", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await PATCH_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`, {
        method: "PATCH",
        body: { title: "x" },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });
});
