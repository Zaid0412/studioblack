/**
 * Vendor portal quote submit endpoint.
 *
 * PUT /api/vendor-portal/rfqs/[rfqId]/quote
 *
 * Critical pins:
 *  - vendor must be invited to the RFQ (403)
 *  - missing items / extra items → 400 (full coverage required)
 *  - quote locked once status moves past `submitted` (409)
 *  - first submission flips rfq.issued → quotes_received (verified via
 *    submitOrUpdateQuote contract — the route just hands input through)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getQuoteForVendor,
  getQuoteStudioRecipients,
  getVendorIdByUserId,
  submitOrUpdateQuote,
} from "@/lib/queries";
import { GET, PUT } from "@/app/api/vendor-portal/rfqs/[rfqId]/quote/route";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { sendQuoteReceivedEmail } from "@/lib/email";
import {
  buildParams,
  buildRequest,
  flushPromises,
  mockSession,
  parseResponse,
  setupAuth,
} from "../helpers";
import { mocks } from "../setup";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const VENDOR_ID = "33333333-3333-4333-8333-333333333333";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ITEM_ID_1 = "44444444-4444-4444-8444-444444444444";
const RFQ_ITEM_ID_2 = "55555555-5555-4555-8555-555555555555";

const vendorSession = mockSession({ role: "vendor", email: "vendor@test.com" });

const mockedFlag = vi.mocked(getServerFeatureFlag);

function freshQuoteResponse() {
  return {
    id: "quote-id-001",
    rfq_id: RFQ_ID,
    vendor_id: VENDOR_ID,
    status: "submitted" as const,
    submitted_at: "2026-05-21T00:00:00Z",
    valid_until: "2026-06-30",
    currency: "USD",
    delivery_period: "4 weeks",
    payment_terms: "Net 30",
    inclusions: null,
    exclusions: null,
    notes: null,
    attachments: null,
    is_late: false,
    awarded_at: null,
    awarded_by: null,
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
    vendor_name: "Hansgrohe",
    vendor_code: "HAN-01",
    items: [
      {
        id: "qi-1",
        quote_id: "quote-id-001",
        rfq_item_id: RFQ_ITEM_ID_1,
        unit_price: 50,
        notes: null,
        alternative_spec: null,
      },
      {
        id: "qi-2",
        quote_id: "quote-id-001",
        rfq_item_id: RFQ_ITEM_ID_2,
        unit_price: 100,
        notes: null,
        alternative_spec: null,
      },
    ],
  };
}

const validBody = {
  validUntil: "2026-06-30",
  currency: "USD",
  deliveryPeriod: "4 weeks",
  paymentTerms: "Net 30",
  items: [
    { rfqItemId: RFQ_ITEM_ID_1, unitPrice: 50 },
    { rfqItemId: RFQ_ITEM_ID_2, unitPrice: 100 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, vendorSession);
  mockedFlag.mockResolvedValue(true);
  vi.mocked(getVendorIdByUserId).mockResolvedValue(VENDOR_ID);

  // Vendor-active probe runs a raw pool.query — return `active` by default.
  mocks.db.query.mockResolvedValue({
    rows: [{ status: "active" }],
    rowCount: 1,
  });

  vi.mocked(submitOrUpdateQuote).mockResolvedValue({
    ok: true,
    quote: freshQuoteResponse() as never,
    isNew: true,
    orgId: "org-test-001",
    projectId: PROJECT_ID,
    rfqNumber: "RFQ-2026-001",
    rfqTitle: "Plumbing",
  });
  vi.mocked(getQuoteForVendor).mockResolvedValue(freshQuoteResponse() as never);
  vi.mocked(getQuoteStudioRecipients).mockResolvedValue([
    { email: "pm@test.com", name: "PM", userId: "user-pm-1" },
  ]);
});

describe("GET /api/vendor-portal/rfqs/[rfqId]/quote", () => {
  it("returns the vendor's existing quote", async () => {
    const res = await GET(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{
      quote: { id: string } | null;
    }>(res);
    expect(status).toBe(200);
    expect(body.quote?.id).toBe("quote-id-001");
    expect(vi.mocked(getQuoteForVendor)).toHaveBeenCalledWith(
      RFQ_ID,
      VENDOR_ID
    );
  });

  it("returns null when vendor hasn't submitted yet", async () => {
    vi.mocked(getQuoteForVendor).mockResolvedValueOnce(null);
    const res = await GET(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ quote: null }>(res);
    expect(status).toBe(200);
    expect(body.quote).toBeNull();
  });

  it("returns 403 when vendor portal flag is disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await GET(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/vendor-portal/rfqs/[rfqId]/quote", () => {
  it("upserts a quote and returns the fresh row", async () => {
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{
      quote: { id: string };
      isNew: boolean;
    }>(res);
    expect(status).toBe(200);
    expect(body.quote.id).toBe("quote-id-001");
    expect(body.isNew).toBe(true);
    expect(vi.mocked(submitOrUpdateQuote)).toHaveBeenCalledWith(
      RFQ_ID,
      VENDOR_ID,
      expect.objectContaining({
        items: validBody.items,
      }),
      // A portal submission always re-marks itself `portal`.
      expect.objectContaining({ responseSource: "portal" })
    );
  });

  it("returns 403 when vendor is not invited", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "vendor_not_invited",
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 with code=rfq_wrong_status when RFQ is awarded/cancelled", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "rfq_wrong_status",
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(409);
    expect(body.code).toBe("rfq_wrong_status");
  });

  it("returns 409 with code=quote_locked when quote moved past submitted", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "quote_locked",
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(409);
    expect(body.code).toBe("quote_locked");
  });

  it("returns 400 when items don't cover every RFQ item", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "missing_items",
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when an unknown rfqItemId is included", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "extra_items",
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid payload (Zod)", async () => {
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: { items: [{ rfqItemId: "not-a-uuid", unitPrice: -1 }] },
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("fires the quote-received email fan-out after commit", async () => {
    await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    await flushPromises();
    expect(vi.mocked(sendQuoteReceivedEmail)).toHaveBeenCalledWith(
      "pm@test.com",
      expect.objectContaining({
        vendorName: "Hansgrohe",
        isRevision: false,
      })
    );
  });

  it("marks revisions with isRevision=true", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: true,
      quote: freshQuoteResponse() as never,
      isNew: false,
      orgId: "org-test-001",
      projectId: PROJECT_ID,
      rfqNumber: "RFQ-2026-001",
      rfqTitle: "Plumbing",
    });
    await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    await flushPromises();
    expect(vi.mocked(sendQuoteReceivedEmail)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ isRevision: true })
    );
  });

  it("returns 403 when vendor is suspended", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ status: "inactive" }],
      rowCount: 1,
    });
    const res = await PUT(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/quote`, {
        method: "PUT",
        body: validBody,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});
