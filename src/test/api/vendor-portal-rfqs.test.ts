/**
 * Vendor-portal RFQ endpoints.
 *
 * GET /api/vendor-portal/rfqs            — RFQs this vendor was invited to.
 * GET /api/vendor-portal/rfqs/[rfqId]    — detail scoped to caller's vendor.
 *
 * Critical pin: detail query returns null when caller isn't in rfq_vendor,
 * which the route must surface as 404. A vendor must not be able to probe
 * for RFQ ids they weren't invited to.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getRfqsForVendor,
  getRfqDetailForVendor,
  getVendorIdByUserId,
} from "@/lib/queries";
import { GET as GET_LIST } from "@/app/api/vendor-portal/rfqs/route";
import { GET as GET_DETAIL } from "@/app/api/vendor-portal/rfqs/[rfqId]/route";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const VENDOR_ID = "33333333-3333-4333-8333-333333333333";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";

const vendorSession = mockSession({ role: "vendor", email: "vendor@test.com" });
const pmSession = mockSession();

const mockedFlag = vi.mocked(getServerFeatureFlag);

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, vendorSession);
  mockedFlag.mockResolvedValue(true);
  vi.mocked(getVendorIdByUserId).mockResolvedValue(VENDOR_ID);
  vi.mocked(getRfqsForVendor).mockResolvedValue({ rows: [], total: 0 });
  vi.mocked(getRfqDetailForVendor).mockResolvedValue(null);
});

describe("GET /api/vendor-portal/rfqs", () => {
  it("returns empty list for a vendor with no invitations", async () => {
    const res = await GET_LIST(
      buildRequest("/api/vendor-portal/rfqs"),
      buildParams({})
    );
    const { status, body } = await parseResponse<{
      rows: unknown[];
      total: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns 403 when vendorPortal flag disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await GET_LIST(
      buildRequest("/api/vendor-portal/rfqs"),
      buildParams({})
    );
    expect(res.status).toBe(403);
  });

  it("blocks non-vendor roles", async () => {
    setupAuth(mocks.auth, pmSession);
    const res = await GET_LIST(
      buildRequest("/api/vendor-portal/rfqs"),
      buildParams({})
    );
    expect(res.status).toBe(403);
  });

  it("scopes the list to the caller's vendor id", async () => {
    await GET_LIST(buildRequest("/api/vendor-portal/rfqs"), buildParams({}));
    expect(vi.mocked(getRfqsForVendor)).toHaveBeenCalledWith(
      VENDOR_ID,
      expect.any(Object)
    );
  });
});

describe("GET /api/vendor-portal/rfqs/[rfqId]", () => {
  it("404s when vendor isn't on the invitation list", async () => {
    vi.mocked(getRfqDetailForVendor).mockResolvedValue(null);
    const res = await GET_DETAIL(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}`),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("returns the RFQ when vendor was invited", async () => {
    vi.mocked(getRfqDetailForVendor).mockResolvedValue({
      id: RFQ_ID,
      org_id: "org-test-001",
      project_id: "11111111-1111-4111-8111-111111111111",
      rfq_number: "RFQ-2026-001",
      title: "Plumbing scope",
      status: "issued",
      issued_date: "2026-05-14",
      response_deadline: "2026-05-30",
      award_date: null,
      awarded_vendor_id: null,
      scope_of_work: null,
      terms_conditions: null,
      attachments: null,
      created_by: "user-test-001",
      created_at: "2026-05-14T00:00:00Z",
      updated_at: "2026-05-14T00:00:00Z",
      items: [],
    });
    const res = await GET_DETAIL(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}`),
      buildParams({ rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ id: string }>(res);
    expect(status).toBe(200);
    expect(body.id).toBe(RFQ_ID);
  });

  it("scopes detail by the caller's vendor id", async () => {
    await GET_DETAIL(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}`),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(vi.mocked(getRfqDetailForVendor)).toHaveBeenCalledWith(
      RFQ_ID,
      VENDOR_ID
    );
  });

  it("returns 403 when flag disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await GET_DETAIL(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}`),
      buildParams({ rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});
