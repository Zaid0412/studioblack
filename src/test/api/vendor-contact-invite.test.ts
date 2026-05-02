import { describe, it, expect, beforeEach, vi } from "vitest";
import { getVendorById } from "@/lib/queries";
import { POST as INVITE } from "@/app/api/vendors/[id]/contacts/[contactId]/invite/route";
import { auth } from "@/lib/auth";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import { buildVendorWithRelations, TEST_VENDOR_ID } from "../fixtures/vendor";
import type { VendorContact } from "@/types";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const VENDOR_ID = TEST_VENDOR_ID;
const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const ORG_ID = "org-test-001";

const fakeContact: VendorContact = {
  id: CONTACT_ID,
  vendor_id: VENDOR_ID,
  name: "Bob Builder",
  title: null,
  email: "bob@test.com",
  phone: null,
  is_primary: true,
  receives_rfq: true,
  user_id: null,
  created_at: "2024-01-01T00:00:00Z",
};

const pmSession = mockSession();

const path = `/api/vendors/${VENDOR_ID}/contacts/${CONTACT_ID}/invite`;
const params = buildParams({ id: VENDOR_ID, contactId: CONTACT_ID });

const mockedFlag = vi.mocked(getServerFeatureFlag);
const mockedGetVendor = vi.mocked(getVendorById);

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  mockedFlag.mockResolvedValue(true);
  mockedGetVendor.mockResolvedValue(
    buildVendorWithRelations({ contacts: [fakeContact] })
  );
  // Default: no existing user, no member
  mocks.db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  // Stub createInvitation so the "invite" path doesn't blow up.
  // @ts-expect-error — augmenting the mock auth.api shape
  auth.api.createInvitation = vi.fn().mockResolvedValue(undefined);
});

describe("POST /api/vendors/[id]/contacts/[contactId]/invite", () => {
  it("returns 403 when vendorPortal flag is disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
    expect(auth.api.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 404 when vendor doesn't exist", async () => {
    mockedGetVendor.mockResolvedValue(null);
    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 404 when contact isn't on the vendor", async () => {
    mockedGetVendor.mockResolvedValue(
      buildVendorWithRelations({ contacts: [] })
    );
    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    expect(res.status).toBe(404);
  });

  it("links to existing org member without sending an invite", async () => {
    // 1st query: user lookup → returns existing user
    // 2nd query: member lookup → returns membership row
    // 3rd query: UPDATE vendor_contact (no rows returned)
    mocks.db.query
      .mockResolvedValueOnce({ rows: [{ id: "user-existing" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("linked");
    expect(auth.api.createInvitation).not.toHaveBeenCalled();

    // Verify the backfill UPDATE ran with the right ids
    const updateCall = mocks.db.query.mock.calls.find(
      ([sql]) =>
        typeof sql === "string" && sql.includes("UPDATE vendor_contact")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual(["user-existing", CONTACT_ID]);
  });

  it("matches user email case-insensitively", async () => {
    const upperContact = { ...fakeContact, email: "BOB@Test.com" };
    mockedGetVendor.mockResolvedValue(
      buildVendorWithRelations({ contacts: [upperContact] })
    );
    mocks.db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await INVITE(buildRequest(path, { method: "POST" }), params);

    const userLookup = mocks.db.query.mock.calls[0];
    expect(userLookup[0]).toMatch(/LOWER\(email\)/);
    expect(userLookup[1]).toEqual(["bob@test.com"]);
  });

  it("sends a new invitation when no existing org member", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("invited");
    expect(auth.api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "bob@test.com",
          role: "vendor",
          organizationId: ORG_ID,
          resend: true,
        }),
      })
    );
  });

  it("returns 400 when createInvitation throws", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // @ts-expect-error — augmenting the mock auth.api shape
    auth.api.createInvitation = vi
      .fn()
      .mockRejectedValue(new Error("Invitation limit reached"));

    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("Invitation limit reached");
  });
});
