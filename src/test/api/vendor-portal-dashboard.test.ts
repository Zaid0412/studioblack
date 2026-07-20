/**
 * Vendor-portal dashboard endpoint.
 *
 * GET /api/vendor-portal/dashboard — aggregated KPIs, quote outcomes, and the
 * RFQs awaiting this vendor's response. Flag-gated and vendor-scoped: the
 * aggregation must always run against the caller's resolved vendor id.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getVendorDashboard, getVendorIdByUserId } from "@/lib/queries";
import { GET } from "@/app/api/vendor-portal/dashboard/route";
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

const vendorSession = mockSession({ role: "vendor", email: "vendor@test.com" });
const pmSession = mockSession();

const mockedFlag = vi.mocked(getServerFeatureFlag);

const emptyDashboard = {
  kpis: { openRfqs: 0, quotesUnderReview: 0, awarded: 0, winRate: 0 },
  outcomes: [],
  awaitingRfqs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, vendorSession);
  mockedFlag.mockResolvedValue(true);
  vi.mocked(getVendorIdByUserId).mockResolvedValue(VENDOR_ID);
  vi.mocked(getVendorDashboard).mockResolvedValue(emptyDashboard);
});

describe("GET /api/vendor-portal/dashboard", () => {
  it("returns the aggregated dashboard for a vendor", async () => {
    const res = await GET(
      buildRequest("/api/vendor-portal/dashboard"),
      buildParams({})
    );
    const { status, body } = await parseResponse<typeof emptyDashboard>(res);
    expect(status).toBe(200);
    expect(body).toEqual(emptyDashboard);
  });

  it("401s when there is no session", async () => {
    setupAuth(mocks.auth, null);
    const res = await GET(
      buildRequest("/api/vendor-portal/dashboard"),
      buildParams({})
    );
    expect(res.status).toBe(401);
  });

  it("403s when the vendorPortal flag is disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await GET(
      buildRequest("/api/vendor-portal/dashboard"),
      buildParams({})
    );
    expect(res.status).toBe(403);
  });

  it("blocks non-vendor roles", async () => {
    setupAuth(mocks.auth, pmSession);
    const res = await GET(
      buildRequest("/api/vendor-portal/dashboard"),
      buildParams({})
    );
    expect(res.status).toBe(403);
  });

  it("scopes the aggregation to the caller's vendor id", async () => {
    await GET(buildRequest("/api/vendor-portal/dashboard"), buildParams({}));
    expect(vi.mocked(getVendorDashboard)).toHaveBeenCalledWith(VENDOR_ID);
  });
});
