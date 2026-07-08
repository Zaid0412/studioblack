import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listRateContracts,
  getRateContractById,
  createRateContract,
  updateRateContract,
  transitionRateContract,
  addRateContractItems,
  removeRateContractItem,
  getActiveRatesForBoqItem,
  getMemberRole,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { GET as LIST, POST as CREATE } from "@/app/api/rate-contracts/route";
import { GET as DETAIL, PATCH } from "@/app/api/rate-contracts/[id]/route";
import { POST as ADD_ITEMS } from "@/app/api/rate-contracts/[id]/items/route";
import { DELETE as REMOVE_ITEM } from "@/app/api/rate-contracts/[id]/items/[itemId]/route";
import { POST as TRANSITION } from "@/app/api/rate-contracts/[id]/transition/route";
import { GET as BY_ELEMENT } from "@/app/api/rate-contracts/by-element/[elementId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { RateContract } from "@/types";

const RC_ID = "55555555-5555-4555-8555-555555555555";
const VENDOR_ID = "11111111-1111-4111-8111-111111111111";
const ELEMENT_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

const fakeContract: RateContract = {
  id: RC_ID,
  org_id: "org-test-001",
  vendor_id: VENDOR_ID,
  contract_number: "RC-2026-001",
  name: "Carpentry 2026",
  status: "draft",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  agreement_signed_date: null,
  currency: "USD",
  payment_terms: null,
  attachments: null,
  terms_and_conditions: null,
  notes: null,
  project_id: null,
  tax_included: false,
  tax_percentage: null,
  created_by: "user-test-001",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

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

// ── GET /api/rate-contracts ────────────────────────────────────────────────

describe("GET /api/rate-contracts", () => {
  it("returns paginated list (PM)", async () => {
    vi.mocked(listRateContracts).mockResolvedValue({
      rows: [fakeContract as never],
      total: 1,
    });
    const res = await LIST(buildRequest("/api/rate-contracts"));
    expect(res.status).toBe(200);
  });

  it("rejects client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await LIST(buildRequest("/api/rate-contracts"));
    expect(res.status).toBe(403);
  });

  it("rejects unknown status filter", async () => {
    const res = await LIST(
      buildRequest("/api/rate-contracts", {
        searchParams: { status: "deleted" },
      })
    );
    expect(res.status).toBe(400);
  });
});

// ── POST /api/rate-contracts ───────────────────────────────────────────────

describe("POST /api/rate-contracts", () => {
  const validBody = {
    vendorId: VENDOR_ID,
    name: "Carpentry 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  };

  it("creates a rate contract", async () => {
    vi.mocked(createRateContract).mockResolvedValue(fakeContract);
    const res = await CREATE(
      buildRequest("/api/rate-contracts", { method: "POST", body: validBody })
    );
    const { status, body } = await parseResponse<RateContract>(res);
    expect(status).toBe(201);
    expect(body.id).toBe(RC_ID);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RATE_CONTRACT_CREATED,
        targetTable: "rate_contract",
        targetId: RC_ID,
      })
    );
  });

  it("rejects endDate before startDate", async () => {
    const res = await CREATE(
      buildRequest("/api/rate-contracts", {
        method: "POST",
        body: { ...validBody, endDate: "2025-12-31" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await CREATE(
      buildRequest("/api/rate-contracts", { method: "POST", body: validBody })
    );
    expect(res.status).toBe(403);
  });

  it("allows architect", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");
    vi.mocked(createRateContract).mockResolvedValue(fakeContract);
    const res = await CREATE(
      buildRequest("/api/rate-contracts", { method: "POST", body: validBody })
    );
    expect(res.status).toBe(201);
  });
});

// ── GET /api/rate-contracts/[id] ───────────────────────────────────────────

describe("GET /api/rate-contracts/[id]", () => {
  it("returns the contract", async () => {
    vi.mocked(getRateContractById).mockResolvedValue({
      ...fakeContract,
      vendor_name: "Acme",
      vendor_kyc_status: "verified",
      items: [],
      item_count: 0,
    } as never);
    const res = await DETAIL(
      buildRequest(`/api/rate-contracts/${RC_ID}`),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when missing", async () => {
    vi.mocked(getRateContractById).mockResolvedValue(null);
    const res = await DETAIL(
      buildRequest(`/api/rate-contracts/${RC_ID}`),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/rate-contracts/[id] ─────────────────────────────────────────

describe("PATCH /api/rate-contracts/[id]", () => {
  it("updates a draft contract and audits the changed columns", async () => {
    vi.mocked(updateRateContract).mockResolvedValue({
      ok: true,
      row: { ...fakeContract, name: "Renamed" },
      changedColumns: ["name"],
    });
    const res = await PATCH(
      buildRequest(`/api/rate-contracts/${RC_ID}`, {
        method: "PATCH",
        body: { name: "Renamed" },
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RATE_CONTRACT_UPDATED,
        targetId: RC_ID,
        metadata: { fields: ["name"] },
      })
    );
  });

  it("does not audit a no-op PATCH that changed no columns", async () => {
    vi.mocked(updateRateContract).mockResolvedValue({
      ok: true,
      row: fakeContract,
      changedColumns: [],
    });
    const res = await PATCH(
      buildRequest(`/api/rate-contracts/${RC_ID}`, {
        method: "PATCH",
        body: {},
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).not.toHaveBeenCalled();
  });

  it("returns 409 when active contract is locked", async () => {
    vi.mocked(updateRateContract).mockResolvedValue({
      ok: false,
      reason: "active_locked",
    });
    const res = await PATCH(
      buildRequest(`/api/rate-contracts/${RC_ID}`, {
        method: "PATCH",
        body: { name: "Renamed" },
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 when missing", async () => {
    vi.mocked(updateRateContract).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await PATCH(
      buildRequest(`/api/rate-contracts/${RC_ID}`, {
        method: "PATCH",
        body: { name: "Renamed" },
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /api/rate-contracts/[id]/items ───────────────────────────────────

describe("POST /api/rate-contracts/[id]/items", () => {
  const body = {
    items: [
      { categoryId: CATEGORY_ID, elementId: ELEMENT_ID, unit: "no", rate: 100 },
    ],
  };

  it("adds items", async () => {
    vi.mocked(addRateContractItems).mockResolvedValue({ ok: true, count: 1 });
    const res = await ADD_ITEMS(
      buildRequest(`/api/rate-contracts/${RC_ID}/items`, {
        method: "POST",
        body,
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(200);
  });

  it("accepts a service-area-only item (no element)", async () => {
    vi.mocked(addRateContractItems).mockResolvedValue({ ok: true, count: 1 });
    const res = await ADD_ITEMS(
      buildRequest(`/api/rate-contracts/${RC_ID}/items`, {
        method: "POST",
        body: { items: [{ categoryId: CATEGORY_ID, unit: "no", rate: 50 }] },
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(200);
    expect(addRateContractItems).toHaveBeenCalledWith(
      expect.any(String),
      RC_ID,
      [{ categoryId: CATEGORY_ID, unit: "no", rate: 50 }]
    );
  });

  it("rejects an item with no service area", async () => {
    const res = await ADD_ITEMS(
      buildRequest(`/api/rate-contracts/${RC_ID}/items`, {
        method: "POST",
        body: { items: [{ elementId: ELEMENT_ID, unit: "no", rate: 50 }] },
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(400);
  });

  it("rejects with 400 on currency mismatch", async () => {
    vi.mocked(addRateContractItems).mockResolvedValue({
      ok: false,
      reason: "currency_mismatch",
    });
    const res = await ADD_ITEMS(
      buildRequest(`/api/rate-contracts/${RC_ID}/items`, {
        method: "POST",
        body,
      }),
      buildParams({ id: RC_ID })
    );
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/rate-contracts/[id]/items/[itemId] ─────────────────────────

describe("DELETE /api/rate-contracts/[id]/items/[itemId]", () => {
  it("removes an item", async () => {
    vi.mocked(removeRateContractItem).mockResolvedValue(true);
    const res = await REMOVE_ITEM(
      buildRequest(`/api/rate-contracts/${RC_ID}/items/${ITEM_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: RC_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when missing", async () => {
    vi.mocked(removeRateContractItem).mockResolvedValue(false);
    const res = await REMOVE_ITEM(
      buildRequest(`/api/rate-contracts/${RC_ID}/items/${ITEM_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: RC_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /api/rate-contracts/[id]/transition ──────────────────────────────

describe("POST /api/rate-contracts/[id]/transition", () => {
  const call = (action: string) =>
    TRANSITION(
      buildRequest(`/api/rate-contracts/${RC_ID}/transition`, {
        method: "POST",
        body: { action },
      }),
      buildParams({ id: RC_ID })
    );

  it("performs a valid transition and returns the row", async () => {
    vi.mocked(transitionRateContract).mockResolvedValue({
      ok: true,
      row: { ...fakeContract, status: "active" },
    });
    const res = await call("activate");
    expect(res.status).toBe(200);
  });

  it("returns 400 for an unknown action", async () => {
    const res = await call("bogus");
    expect(res.status).toBe(400);
  });

  it("returns 404 when missing", async () => {
    vi.mocked(transitionRateContract).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await call("submit");
    expect(res.status).toBe(404);
  });

  it("returns 409 when activating an empty contract", async () => {
    vi.mocked(transitionRateContract).mockResolvedValue({
      ok: false,
      reason: "empty",
    });
    const res = await call("activate");
    expect(res.status).toBe(409);
  });

  it("returns 409 on an illegal transition", async () => {
    vi.mocked(transitionRateContract).mockResolvedValue({
      ok: false,
      reason: "invalid_status_transition",
    });
    const res = await call("approve");
    expect(res.status).toBe(409);
  });

  it("returns 403 when an architect attempts a PM-only action", async () => {
    vi.mocked(transitionRateContract).mockResolvedValue({
      ok: false,
      reason: "forbidden",
    });
    const res = await call("approve");
    expect(res.status).toBe(403);
  });
});

// ── GET /api/rate-contracts/by-element/[elementId] ────────────────────────

describe("GET /api/rate-contracts/by-element/[elementId]", () => {
  it("returns active rates", async () => {
    vi.mocked(getActiveRatesForBoqItem).mockResolvedValue([]);
    const res = await BY_ELEMENT(
      buildRequest(`/api/rate-contracts/by-element/${ELEMENT_ID}`),
      buildParams({ elementId: ELEMENT_ID })
    );
    expect(res.status).toBe(200);
  });

  it("forwards vendorId scope", async () => {
    vi.mocked(getActiveRatesForBoqItem).mockResolvedValue([]);
    await BY_ELEMENT(
      buildRequest(`/api/rate-contracts/by-element/${ELEMENT_ID}`, {
        searchParams: { vendorId: VENDOR_ID },
      }),
      buildParams({ elementId: ELEMENT_ID })
    );
    expect(getActiveRatesForBoqItem).toHaveBeenCalledWith(
      "org-test-001",
      ELEMENT_ID,
      VENDOR_ID
    );
  });
});
