/**
 * POST /api/projects/[id]/rfqs/[rfqId]/communications — pm/architect (§17).
 * Logs a manual, channel-tagged communication as an audit event.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  getRfqVendorName,
  hasProjectAccess,
  logAuditSafe,
  markVendorDistributionMixed,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as POST_COMM } from "@/app/api/projects/[id]/rfqs/[rfqId]/communications/route";
import { buildRequest, buildParams, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const VENDOR_ID = "33333333-3333-4333-8333-333333333333";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });
const vendorSession = mockSession({ role: "vendor", email: "v@test.com" });

const post = (body: unknown, session = pmSession) => {
  setupAuth(mocks.auth, session);
  return POST_COMM(
    buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/communications`, {
      method: "POST",
      body,
    }),
    buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(getRfqVendorName).mockResolvedValue(null);
});

describe("POST .../communications", () => {
  it("logs a communication as an audit event", async () => {
    const res = await post({ channel: "whatsapp", remarks: "reminder sent" });
    expect(res.status).toBe(200);
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_COMMUNICATION_LOGGED,
        targetId: RFQ_ID,
        metadata: expect.objectContaining({
          channel: "whatsapp",
          remarks: "reminder sent",
          vendor_id: null,
          vendor_name: null,
        }),
      })
    );
  });

  it("denormalises the vendor name when a vendor is given", async () => {
    vi.mocked(getRfqVendorName).mockResolvedValue("Acme Co");
    const res = await post({
      channel: "phone",
      vendorId: VENDOR_ID,
      remarks: "called about lead time",
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          vendor_id: VENDOR_ID,
          vendor_name: "Acme Co",
        }),
      })
    );
  });

  it("flips the vendor's distribution to mixed for a per-vendor outbound channel (§11)", async () => {
    vi.mocked(getRfqVendorName).mockResolvedValue("Acme Co");
    const res = await post({
      channel: "whatsapp",
      vendorId: VENDOR_ID,
      remarks: "reminder",
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(markVendorDistributionMixed)).toHaveBeenCalledWith(
      RFQ_ID,
      VENDOR_ID,
      "whatsapp"
    );
  });

  it("does NOT touch distribution for a receipt-format channel (pdf) or a no-vendor log", async () => {
    vi.mocked(getRfqVendorName).mockResolvedValue("Acme Co");
    await post({ channel: "pdf", vendorId: VENDOR_ID, remarks: "quote pdf" });
    await post({ channel: "whatsapp", remarks: "broadcast" }); // no vendorId
    expect(vi.mocked(markVendorDistributionMixed)).not.toHaveBeenCalled();
  });

  it("400 when the vendor isn't on this RFQ", async () => {
    vi.mocked(getRfqVendorName).mockResolvedValue(null);
    const res = await post({
      channel: "email",
      vendorId: VENDOR_ID,
      remarks: "x",
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(logAuditSafe)).not.toHaveBeenCalled();
  });

  it("400 on an invalid channel", async () => {
    expect(
      (await post({ channel: "carrier_pigeon", remarks: "x" })).status
    ).toBe(400);
  });

  it("400 on empty remarks", async () => {
    expect((await post({ channel: "email", remarks: "" })).status).toBe(400);
  });

  it("architect can log", async () => {
    expect(
      (await post({ channel: "email", remarks: "ok" }, architectSession)).status
    ).toBe(200);
  });

  it("blocks client and vendor", async () => {
    expect(
      (await post({ channel: "email", remarks: "x" }, clientSession)).status
    ).toBe(403);
    expect(
      (await post({ channel: "email", remarks: "x" }, vendorSession)).status
    ).toBe(403);
  });
});
