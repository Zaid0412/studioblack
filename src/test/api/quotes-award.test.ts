/**
 * Award endpoints — single + split.
 *
 * POST /api/projects/[id]/rfqs/[rfqId]/award       (single vendor)
 * POST /api/projects/[id]/rfqs/[rfqId]/award-split (per-item)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  awardRfqSingle,
  awardRfqSplit,
  getOrgRole,
  getQuoteDetail,
  getQuotesByRfq,
  getRfqContactsForEmail,
  logAuditSafe,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as AWARD_SINGLE } from "@/app/api/projects/[id]/rfqs/[rfqId]/award/route";
import { POST as AWARD_SPLIT } from "@/app/api/projects/[id]/rfqs/[rfqId]/award-split/route";
import { sendQuoteAwardedEmail } from "@/lib/email";
import {
  buildParams,
  buildRequest,
  flushPromises,
  mockSession,
  setupAuth,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const QUOTE_ID = "44444444-4444-4444-8444-444444444444";
const RFQ_ITEM_ID = "55555555-5555-4555-8555-555555555555";
const QUOTE_ITEM_ID = "66666666-6666-4666-8666-666666666666";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });

const quoteFixture = () => ({
  id: QUOTE_ID,
  rfq_id: RFQ_ID,
  vendor_id: "v-1",
  vendor_name: "Hansgrohe",
  vendor_code: null,
  status: "submitted" as const,
  submitted_at: "2026-05-21T00:00:00Z",
  valid_until: null,
  currency: "USD",
  delivery_period: null,
  payment_terms: null,
  inclusions: null,
  exclusions: null,
  notes: null,
  attachments: null,
  is_late: false,
  awarded_at: null,
  awarded_by: null,
  created_at: "2026-05-21T00:00:00Z",
  updated_at: "2026-05-21T00:00:00Z",
  items: [
    {
      id: QUOTE_ITEM_ID,
      quote_id: QUOTE_ID,
      rfq_item_id: RFQ_ITEM_ID,
      unit_price: 100,
      notes: null,
      alternative_spec: null,
    },
  ],
});

const updatedRfqFixture = () => ({
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing",
  status: "awarded" as const,
  issued_date: "2026-05-14",
  response_deadline: "2026-05-30",
  award_date: "2026-05-21",
  awarded_vendor_id: "v-1",
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  created_by: "user-test-001",
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-21T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(getOrgRole).mockResolvedValue("owner");
  vi.mocked(getQuoteDetail).mockResolvedValue(quoteFixture() as never);
  vi.mocked(awardRfqSingle).mockResolvedValue({
    ok: true,
    rfq: updatedRfqFixture(),
    winningVendorId: "v-1",
    winningVendorName: "Hansgrohe",
  });
  vi.mocked(awardRfqSplit).mockResolvedValue({
    ok: true,
    rfq: updatedRfqFixture(),
  });
  vi.mocked(getRfqContactsForEmail).mockResolvedValue([
    {
      vendorId: "v-1",
      vendorName: "Hansgrohe",
      contactId: "c-1",
      contactName: "Vendor Contact",
      contactEmail: "vendor@test.com",
      contactUserId: null,
    },
  ]);
  vi.mocked(getQuotesByRfq).mockResolvedValue([
    { ...(quoteFixture() as never), status: "awarded" },
  ]);
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/award (single)", () => {
  it("awards a quote and returns the updated RFQ", async () => {
    const res = await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(awardRfqSingle)).toHaveBeenCalledWith(
      RFQ_ID,
      QUOTE_ID,
      "user-test-001"
    );
  });

  it("blocks non-PM (architect)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    const res = await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });

  it("404s when the quote belongs to a different RFQ", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue({
      ...(quoteFixture() as never),
      rfq_id: "some-other-rfq",
    });
    const res = await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("409s when RFQ is in a non-awardable status", async () => {
    vi.mocked(awardRfqSingle).mockResolvedValue({
      ok: false,
      reason: "rfq_wrong_status",
    });
    const res = await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("409s when the chosen quote has expired", async () => {
    vi.mocked(awardRfqSingle).mockResolvedValue({
      ok: false,
      reason: "quote_expired",
    });
    const res = await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("emails the winning vendor's receives_rfq contacts", async () => {
    await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    await flushPromises();
    expect(vi.mocked(sendQuoteAwardedEmail)).toHaveBeenCalledWith(
      "vendor@test.com",
      expect.objectContaining({
        vendorName: "Hansgrohe",
        rfqNumber: "RFQ-2026-001",
      })
    );
  });

  it("logs RFQ_AWARDED and QUOTE_AWARDED audit entries", async () => {
    await AWARD_SINGLE(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award`, {
        method: "POST",
        body: { quoteId: QUOTE_ID },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const actions = vi.mocked(logAuditSafe).mock.calls.map((c) => c[0].action);
    expect(actions).toContain("rfq.awarded");
    expect(actions).toContain("quote.awarded");
  });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/award-split", () => {
  const validBody = {
    awards: [{ rfqItemId: RFQ_ITEM_ID, quoteItemId: QUOTE_ITEM_ID }],
  };

  it("accepts a split award and returns the updated RFQ", async () => {
    const res = await AWARD_SPLIT(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award-split`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(awardRfqSplit)).toHaveBeenCalledWith(
      RFQ_ID,
      validBody.awards,
      "user-test-001"
    );
  });

  it("blocks non-PM", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    const res = await AWARD_SPLIT(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award-split`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });

  it("400s when not every RFQ item is covered", async () => {
    vi.mocked(awardRfqSplit).mockResolvedValue({
      ok: false,
      reason: "incomplete_split",
    });
    const res = await AWARD_SPLIT(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award-split`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400s on bad quote item id", async () => {
    vi.mocked(awardRfqSplit).mockResolvedValue({
      ok: false,
      reason: "quote_not_found",
    });
    const res = await AWARD_SPLIT(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award-split`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("emails every winning vendor after commit", async () => {
    await AWARD_SPLIT(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/award-split`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    await flushPromises();
    await flushPromises();
    expect(vi.mocked(sendQuoteAwardedEmail)).toHaveBeenCalled();
  });
});
