import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getUserByEmail,
  getVendorContactEmail,
  linkVendorContactByEmail,
  validateOrgMembership,
} from "@/lib/queries";
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
import { TEST_VENDOR_ID } from "../fixtures/vendor";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const VENDOR_ID = TEST_VENDOR_ID;
const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const ORG_ID = "org-test-001";
const CONTACT_EMAIL = "bob@test.com";

const pmSession = mockSession();

const path = `/api/vendors/${VENDOR_ID}/contacts/${CONTACT_ID}/invite`;
const params = buildParams({ id: VENDOR_ID, contactId: CONTACT_ID });

const mockedFlag = vi.mocked(getServerFeatureFlag);
const mockedGetContactEmail = vi.mocked(getVendorContactEmail);
const mockedGetUser = vi.mocked(getUserByEmail);
const mockedIsMember = vi.mocked(validateOrgMembership);
const mockedLink = vi.mocked(linkVendorContactByEmail);

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  mockedFlag.mockResolvedValue(true);
  mockedGetContactEmail.mockResolvedValue(CONTACT_EMAIL);
  mockedGetUser.mockResolvedValue(null);
  mockedIsMember.mockResolvedValue(false);
  mockedLink.mockResolvedValue(undefined);
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

  it("returns 404 when the contact isn't found in this org's vendor", async () => {
    mockedGetContactEmail.mockResolvedValue(null);
    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    expect(res.status).toBe(404);
  });

  it("links to existing org member without sending an invite", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-existing" });
    mockedIsMember.mockResolvedValue(true);

    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("linked");
    expect(auth.api.createInvitation).not.toHaveBeenCalled();
    expect(mockedLink).toHaveBeenCalledWith("user-existing", CONTACT_EMAIL);
  });

  it("looks up the user with a lowercased email", async () => {
    mockedGetContactEmail.mockResolvedValue("BOB@Test.com");

    await INVITE(buildRequest(path, { method: "POST" }), params);

    expect(mockedGetUser).toHaveBeenCalledWith("bob@test.com");
  });

  it("sends a new invitation when no existing org member", async () => {
    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("invited");
    expect(auth.api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: CONTACT_EMAIL,
          role: "vendor",
          organizationId: ORG_ID,
          resend: true,
        }),
      })
    );
    expect(mockedLink).not.toHaveBeenCalled();
  });

  it("sends an invitation when the user exists but isn't an org member", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-elsewhere" });
    mockedIsMember.mockResolvedValue(false);

    const res = await INVITE(buildRequest(path, { method: "POST" }), params);
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("invited");
    expect(auth.api.createInvitation).toHaveBeenCalled();
    expect(mockedLink).not.toHaveBeenCalled();
  });

  it("returns 400 when createInvitation throws", async () => {
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
