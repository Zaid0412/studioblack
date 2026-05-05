import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addKycDocument,
  listKycDocuments,
  removeKycDocument,
  setKycStatus,
  logAuditSafe,
  getMemberRole,
} from "@/lib/queries";
import {
  GET as LIST_DOCS,
  POST as ADD_DOC,
} from "@/app/api/vendors/[id]/kyc-documents/route";
import { DELETE as REMOVE_DOC } from "@/app/api/vendors/[id]/kyc-documents/[docId]/route";
import { PATCH as PATCH_STATUS } from "@/app/api/vendors/[id]/kyc-status/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import { buildVendorWithRelations, TEST_VENDOR_ID } from "../fixtures/vendor";
import type {
  VendorKycDocument,
  VendorKycStatus,
  VendorWithRelations,
} from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const VENDOR_ID = TEST_VENDOR_ID;
const DOC_ID = "33333333-3333-4333-8333-333333333333";

const fakeDoc: VendorKycDocument = {
  id: DOC_ID,
  vendor_id: VENDOR_ID,
  doc_type: "trade_licence",
  file_url: "https://example.com/files/licence.pdf",
  file_name: "licence.pdf",
  expires_at: null,
  uploaded_by: "user-test-001",
  uploaded_at: "2026-04-29T00:00:00Z",
  notes: null,
};

const fakeVendorWithRelations = buildVendorWithRelations({
  kyc_status: "verified",
  kyc_verified_at: "2026-04-29T00:00:00Z",
  kyc_verified_by: "user-test-001",
});

const pmSession = mockSession();
const architectSession = mockSession({
  role: "architect",
  email: "arch@test.com",
});
const clientSession = mockSession({ role: "client", email: "client@test.com" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

// ── GET /api/vendors/[id]/kyc-documents ─────────────────────────────────────

describe("GET /api/vendors/[id]/kyc-documents", () => {
  it("returns the document list (PM)", async () => {
    vi.mocked(listKycDocuments).mockResolvedValue([fakeDoc]);

    const res = await LIST_DOCS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<{
      documents: VendorKycDocument[];
    }>(res);
    expect(status).toBe(200);
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].id).toBe(DOC_ID);
  });

  it("allows architect read", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");
    vi.mocked(listKycDocuments).mockResolvedValue([]);

    const res = await LIST_DOCS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
  });

  it("rejects client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await LIST_DOCS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── POST /api/vendors/[id]/kyc-documents ────────────────────────────────────

describe("POST /api/vendors/[id]/kyc-documents", () => {
  const validBody = {
    docType: "trade_licence",
    // Mirrors what the signed-URL route returns: includes the uploader's id.
    fileUrl: `https://example.supabase.co/storage/v1/object/public/attachments/${pmSession.user.id}/123-licence.pdf`,
    fileName: "licence.pdf",
  } as const;

  it("creates a document and reports auto-flipped status", async () => {
    vi.mocked(addKycDocument).mockResolvedValue({
      document: fakeDoc,
      vendorKycStatus: "pending" as VendorKycStatus,
    });

    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: VENDOR_ID })
    );

    const { status, body } = await parseResponse<{
      document: VendorKycDocument;
      vendor_kyc_status: VendorKycStatus;
    }>(res);

    expect(status).toBe(201);
    expect(body.document.id).toBe(DOC_ID);
    expect(body.vendor_kyc_status).toBe("pending");
    expect(addKycDocument).toHaveBeenCalledWith(
      "org-test-001",
      VENDOR_ID,
      "user-test-001",
      expect.objectContaining({
        docType: "trade_licence",
        fileUrl: validBody.fileUrl,
        fileName: validBody.fileName,
      })
    );
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "vendor.kyc.document_added",
      })
    );
  });

  it("does not flip status when vendor already verified", async () => {
    vi.mocked(addKycDocument).mockResolvedValue({
      document: fakeDoc,
      vendorKycStatus: "verified" as VendorKycStatus,
    });

    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<{
      vendor_kyc_status: VendorKycStatus;
    }>(res);
    expect(status).toBe(201);
    expect(body.vendor_kyc_status).toBe("verified");
  });

  it("returns 404 if vendor not in org", async () => {
    vi.mocked(addKycDocument).mockResolvedValue(null);

    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(404);
  });

  it("rejects unknown docType with 400", async () => {
    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: { ...validBody, docType: "passport" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty fileUrl with 400", async () => {
    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: { ...validBody, fileUrl: "" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });

  it("rejects client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await ADD_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/vendors/[id]/kyc-documents/[docId] ──────────────────────────

describe("DELETE /api/vendors/[id]/kyc-documents/[docId]", () => {
  it("deletes a document", async () => {
    vi.mocked(removeKycDocument).mockResolvedValue(true);

    const res = await REMOVE_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents/${DOC_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: VENDOR_ID, docId: DOC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vendor.kyc.document_removed" })
    );
  });

  it("returns 404 when missing", async () => {
    vi.mocked(removeKycDocument).mockResolvedValue(false);

    const res = await REMOVE_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents/${DOC_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: VENDOR_ID, docId: DOC_ID })
    );
    expect(res.status).toBe(404);
  });

  it("rejects client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await REMOVE_DOC(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-documents/${DOC_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: VENDOR_ID, docId: DOC_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/vendors/[id]/kyc-status ──────────────────────────────────────

describe("PATCH /api/vendors/[id]/kyc-status", () => {
  it("flips status to verified (PM)", async () => {
    vi.mocked(setKycStatus).mockResolvedValue(fakeVendorWithRelations);

    const res = await PATCH_STATUS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-status`, {
        method: "PATCH",
        body: { kycStatus: "verified", kycNotes: "All docs valid" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<VendorWithRelations>(res);
    expect(status).toBe(200);
    expect(body.kyc_status).toBe("verified");
    expect(setKycStatus).toHaveBeenCalledWith(
      "org-test-001",
      VENDOR_ID,
      "verified",
      "All docs valid",
      "user-test-001"
    );
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vendor.kyc.status_changed" })
    );
  });

  it("returns 404 if vendor not in org", async () => {
    vi.mocked(setKycStatus).mockResolvedValue(null);

    const res = await PATCH_STATUS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-status`, {
        method: "PATCH",
        body: { kycStatus: "verified" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(404);
  });

  it("rejects architect (PM only)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");

    const res = await PATCH_STATUS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-status`, {
        method: "PATCH",
        body: { kycStatus: "verified" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(403);
  });

  it("rejects unknown status with 400", async () => {
    const res = await PATCH_STATUS(
      buildRequest(`/api/vendors/${VENDOR_ID}/kyc-status`, {
        method: "PATCH",
        body: { kycStatus: "expired" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });
});
