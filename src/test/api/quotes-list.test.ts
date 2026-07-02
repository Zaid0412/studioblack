/**
 * Architect-side quote read endpoints.
 *
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]
 * GET /api/projects/[id]/rfqs/[rfqId]/comparison
 * POST /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/review
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getQuoteComparison,
  getQuoteDetail,
  getQuotesByRfq,
  getQuoteVersionHistory,
  setQuoteUnderReview,
  submitOrUpdateQuote,
  verifyRfqOwnership,
} from "@/lib/queries";
import {
  GET as GET_LIST,
  POST as POST_ENTER,
} from "@/app/api/projects/[id]/rfqs/[rfqId]/quotes/route";
import { GET as GET_DETAIL } from "@/app/api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/route";
import { POST as POST_REVIEW } from "@/app/api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/review/route";
import { GET as GET_COMPARISON } from "@/app/api/projects/[id]/rfqs/[rfqId]/comparison/route";
import { GET as GET_VERSIONS } from "@/app/api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/versions/route";
import {
  buildParams,
  buildRequest,
  mockSession,
  parseResponse,
  setupAuth,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const QUOTE_ID = "44444444-4444-4444-8444-444444444444";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client", email: "client@test.com" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
});

const quoteFixture = (overrides: Partial<{ rfq_id: string }> = {}) => ({
  id: QUOTE_ID,
  rfq_id: RFQ_ID,
  vendor_id: "v-1",
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
  vendor_name: "Hansgrohe",
  vendor_code: null,
  items: [],
  ...overrides,
});

describe("GET /api/projects/[id]/rfqs/[rfqId]/quotes", () => {
  it("returns the list of quotes for an RFQ", async () => {
    vi.mocked(getQuotesByRfq).mockResolvedValue([quoteFixture() as never]);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ quotes: unknown[] }>(res);
    expect(status).toBe(200);
    expect(body.quotes).toHaveLength(1);
    expect(vi.mocked(getQuotesByRfq)).toHaveBeenCalledWith(RFQ_ID);
  });

  it("404s when RFQ doesn't belong to this project", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/quotes (manual entry)", () => {
  const enterBody = {
    vendorId: "33333333-3333-4333-8333-333333333333",
    responseSource: "email",
    receivedDate: "2026-06-01",
    items: [
      { rfqItemId: "55555555-5555-4555-8555-555555555555", unitPrice: 100 },
    ],
  };
  const post = (body: unknown) =>
    POST_ENTER(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes`, {
        method: "POST",
        body,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );

  it("records a manually-entered quote", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: true,
      quote: quoteFixture() as never,
      isNew: true,
      orgId: "org-1",
      projectId: PROJECT_ID,
      rfqNumber: "RFQ-1",
      rfqTitle: "T",
    });
    const res = await post(enterBody);
    expect(res.status).toBe(200);
    expect(vi.mocked(submitOrUpdateQuote)).toHaveBeenCalledWith(
      RFQ_ID,
      enterBody.vendorId,
      expect.any(Object),
      expect.objectContaining({
        responseSource: "email",
        enteredBy: pmSession.user.id,
      })
    );
  });

  it("400s on an invalid body (missing responseSource)", async () => {
    const { responseSource: _omit, ...bad } = enterBody;
    const res = await post(bad);
    expect(res.status).toBe(400);
  });

  it("400s when responseSource is 'portal'", async () => {
    const res = await post({ ...enterBody, responseSource: "portal" });
    expect(res.status).toBe(400);
  });

  it("409s when the vendor isn't invited", async () => {
    vi.mocked(submitOrUpdateQuote).mockResolvedValue({
      ok: false,
      reason: "vendor_not_invited",
    });
    const res = await post(enterBody);
    expect(res.status).toBe(409);
  });

  it("blocks client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await post(enterBody);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]", () => {
  it("returns quote detail", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(quoteFixture() as never);
    const res = await GET_DETAIL(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    const { status, body } = await parseResponse<{ id: string }>(res);
    expect(status).toBe(200);
    expect(body.id).toBe(QUOTE_ID);
  });

  it("404s when the quote belongs to a different RFQ (cross-RFQ spoofing)", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(
      quoteFixture({ rfq_id: "some-other-rfq" }) as never
    );
    const res = await GET_DETAIL(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    expect(res.status).toBe(404);
  });

  it("404s when quote doesn't exist", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(null);
    const res = await GET_DETAIL(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/versions", () => {
  const call = () =>
    GET_VERSIONS(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}/versions`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );

  it("returns the version history", async () => {
    vi.mocked(getQuoteVersionHistory).mockResolvedValue([
      { ...quoteFixture(), version: 2, is_current: true } as never,
      { ...quoteFixture(), version: 1, is_current: false } as never,
    ]);
    const res = await call();
    const { status, body } = await parseResponse<{ versions: unknown[] }>(res);
    expect(status).toBe(200);
    expect(body.versions).toHaveLength(2);
    expect(vi.mocked(getQuoteVersionHistory)).toHaveBeenCalledWith(
      RFQ_ID,
      QUOTE_ID
    );
  });

  it("404s when the RFQ doesn't belong to this project", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("blocks client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await call();
    expect(res.status).toBe(403);
  });
});

describe("GET /api/projects/[id]/rfqs/[rfqId]/comparison", () => {
  it("returns the denormalised comparison payload", async () => {
    vi.mocked(getQuoteComparison).mockResolvedValue({
      rfq_id: RFQ_ID,
      items: [],
      vendors: [],
      invited_no_response: [],
    });
    const res = await GET_COMPARISON(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/comparison`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ rfq_id: string }>(res);
    expect(status).toBe(200);
    expect(body.rfq_id).toBe(RFQ_ID);
  });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/review", () => {
  it("flips a submitted quote to under_review", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(quoteFixture() as never);
    vi.mocked(setQuoteUnderReview).mockResolvedValue({
      ok: true,
      quote: {
        ...quoteFixture(),
        status: "under_review",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const res = await POST_REVIEW(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}/review`,
        { method: "POST" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    expect(res.status).toBe(200);
  });

  it("404s when quote doesn't belong to this RFQ", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(
      quoteFixture({ rfq_id: "some-other-rfq" }) as never
    );
    const res = await POST_REVIEW(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}/review`,
        { method: "POST" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    expect(res.status).toBe(404);
  });

  it("409s when quote is already past submitted", async () => {
    vi.mocked(getQuoteDetail).mockResolvedValue(quoteFixture() as never);
    vi.mocked(setQuoteUnderReview).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await POST_REVIEW(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}/review`,
        { method: "POST" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, quoteId: QUOTE_ID })
    );
    expect(res.status).toBe(409);
  });
});
