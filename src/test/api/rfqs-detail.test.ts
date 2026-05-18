/**
 * GET /api/projects/[id]/rfqs/[rfqId] — RFQ detail.
 * GET /api/projects/[id]/rfqs/[rfqId]/suggested-vendors — trade-match vendors.
 *
 * Pins the cross-project ownership probe (`verifyRfqOwnership`): callers can
 * have access to project A but pass an rfqId belonging to project B — the
 * route must 404, not 200 with leaked data.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  verifyRfqOwnership,
  getRfqDetail,
  getSuggestedVendorsForRfq,
  hasProjectAccess,
} from "@/lib/queries";
import { GET as GET_DETAIL } from "@/app/api/projects/[id]/rfqs/[rfqId]/route";
import { GET as GET_SUGGESTED } from "@/app/api/projects/[id]/rfqs/[rfqId]/suggested-vendors/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { RfqWithItems, VendorLite } from "@/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const sampleDetail: RfqWithItems = {
  id: RFQ_ID,
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing scope",
  status: "draft",
  issued_date: null,
  response_deadline: null,
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  created_by: "user-test-001",
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
  items: [],
  vendors: [],
  events: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(getRfqDetail).mockResolvedValue(sampleDetail);
  vi.mocked(getSuggestedVendorsForRfq).mockResolvedValue([]);
});

describe("GET /api/projects/[id]/rfqs/[rfqId]", () => {
  it("returns the RFQ for an in-project rfqId", async () => {
    const res = await GET_DETAIL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<RfqWithItems>(res);
    expect(status).toBe(200);
    expect(body.id).toBe(RFQ_ID);
  });

  it("404s when rfqId belongs to a different project", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await GET_DETAIL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("404s when ownership passes but detail is missing (race window)", async () => {
    vi.mocked(getRfqDetail).mockResolvedValue(null);
    const res = await GET_DETAIL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_DETAIL(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}`),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/projects/[id]/rfqs/[rfqId]/suggested-vendors", () => {
  it("returns the suggested vendor list", async () => {
    const vendor: VendorLite = {
      id: "33333333-3333-4333-8333-333333333333",
      company_name: "Acme Plumbing",
      vendor_code: "V001",
      status: "active",
      rating: 4.5,
      primary_contact_email: "ops@acme.test",
    };
    vi.mocked(getSuggestedVendorsForRfq).mockResolvedValue([vendor]);

    const res = await GET_SUGGESTED(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/suggested-vendors`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ vendors: VendorLite[] }>(
      res
    );
    expect(status).toBe(200);
    expect(body.vendors).toHaveLength(1);
    expect(body.vendors[0].company_name).toBe("Acme Plumbing");
  });

  it("404s on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await GET_SUGGESTED(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/suggested-vendors`
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });
});
