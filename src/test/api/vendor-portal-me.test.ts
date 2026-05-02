import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getVendorIdByUserId,
  getVendorSelfById,
  updateVendorSelf,
  addKycDocumentBySelf,
  removeKycDocumentBySelf,
  addVendorContactSelf,
  updateVendorContactSelf,
  deleteVendorContactSelf,
} from "@/lib/queries";
import { GET as GET_ME, PATCH as PATCH_ME } from "@/app/api/vendor-portal/me/route";
import { POST as POST_KYC } from "@/app/api/vendor-portal/me/kyc-documents/route";
import { DELETE as DELETE_KYC } from "@/app/api/vendor-portal/me/kyc-documents/[docId]/route";
import { POST as POST_CONTACT } from "@/app/api/vendor-portal/me/contacts/route";
import {
  PATCH as PATCH_CONTACT,
  DELETE as DELETE_CONTACT,
} from "@/app/api/vendor-portal/me/contacts/[contactId]/route";
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

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
  captureServerException: vi.fn(),
}));

const CONTACT_ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "55555555-5555-4555-8555-555555555555";

const vendorSession = mockSession({ role: "vendor", email: "vendor@test.com" });
const pmSession = mockSession();

const mockedFlag = vi.mocked(getServerFeatureFlag);
const mockedGetVendorId = vi.mocked(getVendorIdByUserId);
const mockedGetVendorSelf = vi.mocked(getVendorSelfById);
const mockedUpdateVendorSelf = vi.mocked(updateVendorSelf);
const mockedAddKyc = vi.mocked(addKycDocumentBySelf);
const mockedRemoveKyc = vi.mocked(removeKycDocumentBySelf);
const mockedAddContact = vi.mocked(addVendorContactSelf);
const mockedUpdateContact = vi.mocked(updateVendorContactSelf);
const mockedDeleteContact = vi.mocked(deleteVendorContactSelf);

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, vendorSession);
  mockedFlag.mockResolvedValue(true);
  mockedGetVendorId.mockResolvedValue(TEST_VENDOR_ID);
  mockedGetVendorSelf.mockResolvedValue(buildVendorWithRelations());
  // ensureVendorActive() reads vendor.status via raw SQL
  mocks.db.query.mockResolvedValue({ rows: [{ status: "active" }], rowCount: 1 });
});

describe("GET /api/vendor-portal/me", () => {
  it("returns 403 when vendorPortal flag is disabled", async () => {
    mockedFlag.mockResolvedValue(false);
    const res = await GET_ME(
      buildRequest("/api/vendor-portal/me"),
      buildParams({})
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it("returns 403 when caller is not a vendor", async () => {
    setupAuth(mocks.auth, pmSession);
    const res = await GET_ME(
      buildRequest("/api/vendor-portal/me"),
      buildParams({})
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when the vendor user has no linked vendor record", async () => {
    mockedGetVendorId.mockResolvedValue(null);
    const res = await GET_ME(
      buildRequest("/api/vendor-portal/me"),
      buildParams({})
    );
    expect(res.status).toBe(404);
  });

  it("returns vendor + suspended:false for an active vendor", async () => {
    const res = await GET_ME(
      buildRequest("/api/vendor-portal/me"),
      buildParams({})
    );
    const { status, body } = await parseResponse<{
      vendor: { id: string };
      suspended: boolean;
    }>(res);
    expect(status).toBe(200);
    expect(body.vendor.id).toBe(TEST_VENDOR_ID);
    expect(body.suspended).toBe(false);
  });

  it("returns suspended:true when vendor.status is inactive", async () => {
    mockedGetVendorSelf.mockResolvedValue(
      buildVendorWithRelations({ status: "inactive" })
    );
    const res = await GET_ME(
      buildRequest("/api/vendor-portal/me"),
      buildParams({})
    );
    const { body } = await parseResponse<{ suspended: boolean }>(res);
    expect(body.suspended).toBe(true);
  });
});

describe("PATCH /api/vendor-portal/me", () => {
  it("updates whitelisted fields", async () => {
    mockedUpdateVendorSelf.mockResolvedValue(
      buildVendorWithRelations({ trading_name: "Acme Trading" })
    );
    const res = await PATCH_ME(
      buildRequest("/api/vendor-portal/me", {
        method: "PATCH",
        body: { tradingName: "Acme Trading" },
      }),
      buildParams({})
    );
    expect(res.status).toBe(200);
    expect(mockedUpdateVendorSelf).toHaveBeenCalledWith(
      TEST_VENDOR_ID,
      expect.objectContaining({ tradingName: "Acme Trading" })
    );
  });

  it("rejects PM-controlled fields by ignoring them at parse time", async () => {
    mockedUpdateVendorSelf.mockResolvedValue(buildVendorWithRelations());
    await PATCH_ME(
      buildRequest("/api/vendor-portal/me", {
        method: "PATCH",
        body: { status: "blacklisted", tradingName: "Acme" },
      }),
      buildParams({})
    );
    // The schema strips unknown keys; only `tradingName` should reach the query.
    const lastCall = mockedUpdateVendorSelf.mock.calls.at(-1)!;
    expect(lastCall[1]).not.toHaveProperty("status");
    expect(lastCall[1]).toHaveProperty("tradingName", "Acme");
  });

  it("returns 403 when vendor is suspended", async () => {
    mocks.db.query.mockResolvedValue({
      rows: [{ status: "inactive" }],
      rowCount: 1,
    });
    const res = await PATCH_ME(
      buildRequest("/api/vendor-portal/me", {
        method: "PATCH",
        body: { tradingName: "x" },
      }),
      buildParams({})
    );
    const { status, body } = await parseResponse<{ code?: string }>(res);
    expect(status).toBe(403);
    expect(body.code).toBe("vendor_suspended");
    expect(mockedUpdateVendorSelf).not.toHaveBeenCalled();
  });
});

describe("POST /api/vendor-portal/me/kyc-documents", () => {
  it("uploads and returns the new document + flipped vendor_kyc_status", async () => {
    mockedAddKyc.mockResolvedValue({
      document: {
        id: DOC_ID,
        vendor_id: TEST_VENDOR_ID,
        doc_type: "trade_licence",
        file_url: "https://example.com/file.pdf",
        file_name: "licence.pdf",
        expires_at: null,
        uploaded_by: vendorSession.user.id,
        uploaded_at: "2026-04-27T00:00:00Z",
        notes: null,
      },
      vendorKycStatus: "pending",
    });

    const res = await POST_KYC(
      buildRequest("/api/vendor-portal/me/kyc-documents", {
        method: "POST",
        body: {
          docType: "trade_licence",
          fileUrl: "https://example.com/file.pdf",
          fileName: "licence.pdf",
        },
      }),
      buildParams({})
    );

    const { status, body } = await parseResponse<{
      vendor_kyc_status: string;
    }>(res);
    expect(status).toBe(201);
    expect(body.vendor_kyc_status).toBe("pending");
    expect(mockedAddKyc).toHaveBeenCalledWith(
      TEST_VENDOR_ID,
      vendorSession.user.id,
      expect.objectContaining({ docType: "trade_licence" })
    );
  });
});

describe("DELETE /api/vendor-portal/me/kyc-documents/[docId]", () => {
  it("returns 404 when the doc isn't on this vendor", async () => {
    mockedRemoveKyc.mockResolvedValue(false);
    const res = await DELETE_KYC(
      buildRequest(`/api/vendor-portal/me/kyc-documents/${DOC_ID}`, {
        method: "DELETE",
      }),
      buildParams({ docId: DOC_ID })
    );
    expect(res.status).toBe(404);
  });

  it("succeeds when removeKycDocumentBySelf finds a row", async () => {
    mockedRemoveKyc.mockResolvedValue(true);
    const res = await DELETE_KYC(
      buildRequest(`/api/vendor-portal/me/kyc-documents/${DOC_ID}`, {
        method: "DELETE",
      }),
      buildParams({ docId: DOC_ID })
    );
    expect(res.status).toBe(200);
    expect(mockedRemoveKyc).toHaveBeenCalledWith(TEST_VENDOR_ID, DOC_ID);
  });
});

describe("POST /api/vendor-portal/me/contacts", () => {
  it("appends a contact and returns 201 with the new id", async () => {
    mockedAddContact.mockResolvedValue({ id: CONTACT_ID });
    const res = await POST_CONTACT(
      buildRequest("/api/vendor-portal/me/contacts", {
        method: "POST",
        body: { name: "Alice", email: "alice@vendor.test" },
      }),
      buildParams({})
    );
    const { status, body } = await parseResponse<{ id: string }>(res);
    expect(status).toBe(201);
    expect(body.id).toBe(CONTACT_ID);
  });
});

describe("PATCH /api/vendor-portal/me/contacts/[contactId]", () => {
  it("patches an existing contact", async () => {
    mockedUpdateContact.mockResolvedValue(true);
    const res = await PATCH_CONTACT(
      buildRequest(`/api/vendor-portal/me/contacts/${CONTACT_ID}`, {
        method: "PATCH",
        body: { receivesRfq: false },
      }),
      buildParams({ contactId: CONTACT_ID })
    );
    expect(res.status).toBe(200);
    expect(mockedUpdateContact).toHaveBeenCalledWith(
      TEST_VENDOR_ID,
      CONTACT_ID,
      expect.objectContaining({ receivesRfq: false })
    );
  });
});

describe("DELETE /api/vendor-portal/me/contacts/[contactId]", () => {
  it("returns 409 when the contact is linked to a portal user", async () => {
    mockedDeleteContact.mockResolvedValue({ ok: false, reason: "linked" });
    const res = await DELETE_CONTACT(
      buildRequest(`/api/vendor-portal/me/contacts/${CONTACT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ contactId: CONTACT_ID })
    );
    const { status, body } = await parseResponse<{ code?: string }>(res);
    expect(status).toBe(409);
    expect(body.code).toBe("contact_linked");
  });

  it("returns 404 when the contact doesn't exist on this vendor", async () => {
    mockedDeleteContact.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await DELETE_CONTACT(
      buildRequest(`/api/vendor-portal/me/contacts/${CONTACT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ contactId: CONTACT_ID })
    );
    expect(res.status).toBe(404);
  });

  it("succeeds when the contact is unlinked", async () => {
    mockedDeleteContact.mockResolvedValue({ ok: true });
    const res = await DELETE_CONTACT(
      buildRequest(`/api/vendor-portal/me/contacts/${CONTACT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ contactId: CONTACT_ID })
    );
    expect(res.status).toBe(200);
  });
});
