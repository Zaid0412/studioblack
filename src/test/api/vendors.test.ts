import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  softDeleteVendor,
  hardDeleteVendor,
  updateVendorRating,
  getVendorBankDetailsEnvelope,
  updateVendorBankDetails,
  getVendorsByTrade,
  logAudit,
  getMemberRole,
} from "@/lib/queries";
import { GET as LIST, POST as CREATE } from "@/app/api/vendors/route";
import { GET as DETAIL, PATCH, DELETE } from "@/app/api/vendors/[id]/route";
import {
  GET as GET_BANK,
  PUT as PUT_BANK,
} from "@/app/api/vendors/[id]/bank-details/route";
import { PATCH as PATCH_RATING } from "@/app/api/vendors/[id]/rating/route";
import { GET as BY_TRADE } from "@/app/api/vendors/by-trade/[categoryId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import {
  buildVendor,
  buildVendorWithRelations,
  TEST_VENDOR_ID,
} from "../fixtures/vendor";
import { encryptBankDetails } from "@/lib/vendorEncryption";
import type { Vendor, VendorWithRelations, BankDetails } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const VENDOR_ID = TEST_VENDOR_ID;
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const fakeVendor: Vendor = buildVendor();
const fakeVendorWithRelations: VendorWithRelations = buildVendorWithRelations();

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

// ── GET /api/vendors ────────────────────────────────────────────────────────

describe("GET /api/vendors", () => {
  it("returns paginated vendor list", async () => {
    vi.mocked(getVendors).mockResolvedValue({
      rows: [fakeVendor as never],
      total: 1,
    });

    const res = await LIST(buildRequest("/api/vendors"));
    const { status, body } = await parseResponse<{
      rows: Vendor[];
      total: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.rows[0].id).toBe(VENDOR_ID);
  });

  it("rejects unknown status filter with 400", async () => {
    const res = await LIST(
      buildRequest("/api/vendors", { searchParams: { status: "deleted" } })
    );
    expect(res.status).toBe(400);
  });

  it("forwards search and trade filters", async () => {
    vi.mocked(getVendors).mockResolvedValue({ rows: [], total: 0 });

    await LIST(
      buildRequest("/api/vendors", {
        searchParams: { search: "acme", tradeCategoryId: CATEGORY_ID },
      })
    );
    expect(getVendors).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({ search: "acme", tradeCategoryId: CATEGORY_ID })
    );
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await LIST(buildRequest("/api/vendors"));
    expect(res.status).toBe(403);
  });
});

// ── POST /api/vendors ───────────────────────────────────────────────────────

describe("POST /api/vendors", () => {
  it("creates a vendor (PM)", async () => {
    vi.mocked(createVendor).mockResolvedValue(fakeVendorWithRelations);

    const res = await CREATE(
      buildRequest("/api/vendors", {
        method: "POST",
        body: { companyName: "Acme Co" },
      })
    );

    const { status, body } = await parseResponse<VendorWithRelations>(res);
    expect(status).toBe(201);
    expect(body.id).toBe(VENDOR_ID);
  });

  it("rejects empty companyName", async () => {
    const res = await CREATE(
      buildRequest("/api/vendors", { method: "POST", body: {} })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for architect", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");
    const res = await CREATE(
      buildRequest("/api/vendors", {
        method: "POST",
        body: { companyName: "Acme Co" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("maps duplicate-key errors to 409", async () => {
    vi.mocked(createVendor).mockRejectedValue(
      new Error("Duplicate key — another row with this code already exists")
    );

    const res = await CREATE(
      buildRequest("/api/vendors", {
        method: "POST",
        body: { companyName: "Acme Co", vendorCode: "V001" },
      })
    );
    expect(res.status).toBe(409);
  });
});

// ── GET /api/vendors/[id] ───────────────────────────────────────────────────

describe("GET /api/vendors/[id]", () => {
  it("returns the vendor with relations", async () => {
    vi.mocked(getVendorById).mockResolvedValue(fakeVendorWithRelations);

    const res = await DETAIL(
      buildRequest(`/api/vendors/${VENDOR_ID}`),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<VendorWithRelations>(res);
    expect(status).toBe(200);
    expect(body.id).toBe(VENDOR_ID);
  });

  it("returns 404 for missing", async () => {
    vi.mocked(getVendorById).mockResolvedValue(null);

    const res = await DETAIL(
      buildRequest(`/api/vendors/${VENDOR_ID}`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/vendors/[id] ─────────────────────────────────────────────────

describe("PATCH /api/vendors/[id]", () => {
  it("updates a vendor (architect allowed)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(updateVendor).mockResolvedValue(fakeVendorWithRelations);

    const res = await PATCH(
      buildRequest(`/api/vendors/${VENDOR_ID}`, {
        method: "PATCH",
        body: { tradingName: "Acme Trading" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
  });

  it("rejects rating in patch (separate endpoint)", async () => {
    vi.mocked(updateVendor).mockResolvedValue(fakeVendorWithRelations);
    await PATCH(
      buildRequest(`/api/vendors/${VENDOR_ID}`, {
        method: "PATCH",
        body: { rating: 4.5 },
      }),
      buildParams({ id: VENDOR_ID })
    );
    // updateVendor should be called without rating in the parsed payload
    const called = vi.mocked(updateVendor).mock.calls[0]?.[2];
    expect(called).toBeDefined();
    expect("rating" in (called as Record<string, unknown>)).toBe(false);
  });
});

// ── DELETE /api/vendors/[id] ────────────────────────────────────────────────

describe("DELETE /api/vendors/[id]", () => {
  it("soft deletes by default", async () => {
    vi.mocked(softDeleteVendor).mockResolvedValue(true);

    const res = await DELETE(
      buildRequest(`/api/vendors/${VENDOR_ID}`, { method: "DELETE" }),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<{
      success: boolean;
      mode: string;
    }>(res);
    expect(status).toBe(200);
    expect(body.mode).toBe("soft");
    expect(softDeleteVendor).toHaveBeenCalled();
    expect(hardDeleteVendor).not.toHaveBeenCalled();
  });

  it("hard deletes when ?hard=true", async () => {
    vi.mocked(hardDeleteVendor).mockResolvedValue(true);

    const res = await DELETE(
      buildRequest(`/api/vendors/${VENDOR_ID}`, {
        method: "DELETE",
        searchParams: { hard: "true" },
      }),
      buildParams({ id: VENDOR_ID })
    );
    const { body } = await parseResponse<{ mode: string }>(res);
    expect(body.mode).toBe("hard");
    expect(hardDeleteVendor).toHaveBeenCalled();
  });

  it("returns 403 for architect", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");
    const res = await DELETE(
      buildRequest(`/api/vendors/${VENDOR_ID}`, { method: "DELETE" }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/vendors/[id]/rating ──────────────────────────────────────────

describe("PATCH /api/vendors/[id]/rating", () => {
  it("updates rating (architect allowed)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(updateVendorRating).mockResolvedValue(fakeVendor);

    const res = await PATCH_RATING(
      buildRequest(`/api/vendors/${VENDOR_ID}/rating`, {
        method: "PATCH",
        body: { rating: 4.5 },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
  });

  it("rejects rating > 5", async () => {
    const res = await PATCH_RATING(
      buildRequest(`/api/vendors/${VENDOR_ID}/rating`, {
        method: "PATCH",
        body: { rating: 6 },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-half-step rating", async () => {
    const res = await PATCH_RATING(
      buildRequest(`/api/vendors/${VENDOR_ID}/rating`, {
        method: "PATCH",
        body: { rating: 3.7 },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });
});

// ── /api/vendors/[id]/bank-details ──────────────────────────────────────────

describe("Vendor bank-details endpoint", () => {
  const sample: BankDetails = { iban: "GB29NWBK60161331926819" };

  it("PM can read bank details — decrypted", async () => {
    const envelope = encryptBankDetails(sample);
    vi.mocked(getVendorBankDetailsEnvelope).mockResolvedValue({
      exists: true,
      envelope,
    });

    const res = await GET_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`),
      buildParams({ id: VENDOR_ID })
    );
    const { status, body } = await parseResponse<{ data: BankDetails }>(res);
    expect(status).toBe(200);
    expect(body.data.iban).toBe(sample.iban);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vendor.bank_details.read" })
    );
  });

  it("returns null when no bank details set", async () => {
    vi.mocked(getVendorBankDetailsEnvelope).mockResolvedValue({
      exists: true,
      envelope: null,
    });

    const res = await GET_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`),
      buildParams({ id: VENDOR_ID })
    );
    const { body } = await parseResponse<{ data: BankDetails | null }>(res);
    expect(body.data).toBeNull();
  });

  it("returns 404 when vendor not in org", async () => {
    vi.mocked(getVendorBankDetailsEnvelope).mockResolvedValue({
      exists: false,
      envelope: null,
    });

    const res = await GET_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(404);
  });

  it("architect cannot read bank details (403)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");

    const res = await GET_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(403);
  });

  it("PM can write bank details — encrypted + audit-logged", async () => {
    vi.mocked(updateVendorBankDetails).mockResolvedValue(true);

    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: { data: sample },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
    expect(updateVendorBankDetails).toHaveBeenCalledWith(
      "org-test-001",
      VENDOR_ID,
      expect.objectContaining({ version: 1 })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "vendor.bank_details.write" })
    );
  });

  it("PUT { data: null } clears the envelope", async () => {
    vi.mocked(updateVendorBankDetails).mockResolvedValue(true);

    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: { data: null },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
    expect(updateVendorBankDetails).toHaveBeenCalledWith(
      "org-test-001",
      VENDOR_ID,
      null
    );
  });

  it("PUT 404s when the vendor isn't in the org", async () => {
    vi.mocked(updateVendorBankDetails).mockResolvedValue(false);

    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: { data: sample },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(404);
  });

  it("PUT 400s when the body envelope is missing the `data` key", async () => {
    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: sample, // raw shape — no { data } wrapper
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown bank-details fields (.strict)", async () => {
    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: { data: { iban: "X", password: "secret" } },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(400);
  });

  // Audit failures must not block the underlying mutation — they're a
  // best-effort side effect. A future refactor that re-throws here would
  // silently regress to "audit DB hiccup crashes the request".
  it("returns 200 on PUT even when logAudit rejects", async () => {
    vi.mocked(updateVendorBankDetails).mockResolvedValue(true);
    vi.mocked(logAudit).mockRejectedValueOnce(new Error("audit DB down"));

    const res = await PUT_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`, {
        method: "PUT",
        body: { data: sample },
      }),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
    // The vendor row was still mutated, only the audit log failed.
    expect(updateVendorBankDetails).toHaveBeenCalled();
  });

  it("returns 200 on GET even when logAudit rejects", async () => {
    vi.mocked(getVendorBankDetailsEnvelope).mockResolvedValue({
      exists: true,
      envelope: null,
    });
    vi.mocked(logAudit).mockRejectedValueOnce(new Error("audit DB down"));

    const res = await GET_BANK(
      buildRequest(`/api/vendors/${VENDOR_ID}/bank-details`),
      buildParams({ id: VENDOR_ID })
    );
    expect(res.status).toBe(200);
  });
});

// ── GET /api/vendors/by-trade/[categoryId] ──────────────────────────────────

describe("GET /api/vendors/by-trade/[categoryId]", () => {
  it("returns vendors for a trade", async () => {
    vi.mocked(getVendorsByTrade).mockResolvedValue([
      {
        id: VENDOR_ID,
        company_name: "Acme",
        vendor_code: "V001",
        status: "active",
        rating: 4,
        primary_contact_email: "alice@acme.com",
      },
    ]);

    const res = await BY_TRADE(
      buildRequest(`/api/vendors/by-trade/${CATEGORY_ID}`),
      buildParams({ categoryId: CATEGORY_ID })
    );
    const { status, body } = await parseResponse<{
      rows: Array<{ id: string }>;
    }>(res);
    expect(status).toBe(200);
    expect(body.rows).toHaveLength(1);
  });

  it("returns 403 for client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await BY_TRADE(
      buildRequest(`/api/vendors/by-trade/${CATEGORY_ID}`),
      buildParams({ categoryId: CATEGORY_ID })
    );
    expect(res.status).toBe(403);
  });
});
