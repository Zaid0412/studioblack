/**
 * §14 vendor decline routes.
 *  - PUT  /api/vendor-portal/rfqs/[rfqId]/decline    (vendor declines)
 *  - POST /api/projects/[id]/rfqs/[rfqId]/quotes/decline  (PM records a decline)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  declineQuote,
  getVendorIdByUserId,
  getQuoteStudioRecipients,
  hasProjectAccess,
  verifyRfqOwnership,
} from "@/lib/queries";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { PUT as PORTAL_DECLINE } from "@/app/api/vendor-portal/rfqs/[rfqId]/decline/route";
import { POST as STUDIO_DECLINE } from "@/app/api/projects/[id]/rfqs/[rfqId]/quotes/decline/route";
import { buildRequest, buildParams, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const VENDOR_ID = "33333333-3333-4333-8333-333333333333";

const okResult = {
  ok: true as const,
  quote: { id: "q-1" },
  orgId: "org-1",
  projectId: PROJECT_ID,
  rfqNumber: "RFQ-2026-001",
  rfqTitle: "Plumbing",
  vendorName: "Acme Co",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerFeatureFlag).mockResolvedValue(true);
  vi.mocked(getVendorIdByUserId).mockResolvedValue(VENDOR_ID);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(getQuoteStudioRecipients).mockResolvedValue([]);
  vi.mocked(declineQuote).mockResolvedValue(okResult as never);
  // Vendor-active probe (raw pool.query) → active.
  mocks.db.query.mockResolvedValue({
    rows: [{ status: "active" }],
    rowCount: 1,
  });
});

describe("PUT /api/vendor-portal/rfqs/[rfqId]/decline", () => {
  const vendorSession = mockSession({ role: "vendor", email: "v@test.com" });
  const decline = (body: unknown) => {
    setupAuth(mocks.auth, vendorSession);
    return PORTAL_DECLINE(
      buildRequest(`/api/vendor-portal/rfqs/${RFQ_ID}/decline`, {
        method: "PUT",
        body,
      }),
      buildParams({ rfqId: RFQ_ID })
    );
  };

  it("declines with a reason and stamps portal source", async () => {
    const res = await decline({ reason: "no capacity" });
    expect(res.status).toBe(200);
    expect(vi.mocked(declineQuote)).toHaveBeenCalledWith(
      RFQ_ID,
      VENDOR_ID,
      expect.objectContaining({
        responseSource: "portal",
        reason: "no capacity",
      })
    );
  });

  it("allows an empty body (no reason)", async () => {
    const res = await decline({});
    expect(res.status).toBe(200);
  });

  it("maps quote_locked → 409", async () => {
    vi.mocked(declineQuote).mockResolvedValue({
      ok: false,
      reason: "quote_locked",
    });
    expect((await decline({})).status).toBe(409);
  });

  it("maps vendor_not_invited → 403", async () => {
    vi.mocked(declineQuote).mockResolvedValue({
      ok: false,
      reason: "vendor_not_invited",
    });
    expect((await decline({})).status).toBe(403);
  });
});

describe("POST /api/projects/[id]/rfqs/[rfqId]/quotes/decline", () => {
  const pmSession = mockSession();
  const clientSession = mockSession({ role: "client" });
  const decline = (body: unknown, session = pmSession) => {
    setupAuth(mocks.auth, session);
    return STUDIO_DECLINE(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/quotes/decline`,
        {
          method: "POST",
          body,
        }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
  };

  it("records a decline for the given vendor, stamped manual + enteredBy", async () => {
    const res = await decline({ vendorId: VENDOR_ID, reason: "phoned in" });
    expect(res.status).toBe(200);
    const call = vi.mocked(declineQuote).mock.calls[0]!;
    expect(call[1]).toBe(VENDOR_ID);
    expect(call[2]).toMatchObject({
      responseSource: "manual",
      reason: "phoned in",
      enteredBy: expect.any(String),
    });
  });

  it("400 when vendorId is missing (Zod)", async () => {
    expect((await decline({ reason: "x" })).status).toBe(400);
  });

  it("blocks the client role", async () => {
    expect((await decline({ vendorId: VENDOR_ID }, clientSession)).status).toBe(
      403
    );
  });
});
