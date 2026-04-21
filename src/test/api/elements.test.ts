import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getElements,
  getElementById,
  createElement,
  updateElement,
  softDeleteElement,
  restoreElement,
  duplicateElement,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/elements/route";
import {
  GET as GET_ITEM,
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/elements/[id]/route";
import { POST as POST_DUPLICATE } from "@/app/api/elements/[id]/duplicate/route";
import { POST as POST_RESTORE } from "@/app/api/elements/[id]/restore/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { Element, ElementWithDetails } from "@/types";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const ELEM_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const CAT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const fakeElement: Element = {
  id: ELEM_ID,
  org_id: "org-test-001",
  code: "WAL-PNT-001",
  name: "Emulsion Paint",
  description: null,
  category_id: CAT_ID,
  unit: "m2",
  unit_cost: "120.00",
  currency: "INR",
  material_cost: null,
  labour_cost: null,
  overhead_pct: null,
  margin_pct: null,
  spec_reference: null,
  drawing_ref: null,
  tags: null,
  is_active: true,
  created_by: "user-test-001",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const fakeDetailed: ElementWithDetails = {
  ...fakeElement,
  attributes: [],
  category_path: ["Finishes", "Wall Finishes"],
};

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

// ── GET /api/elements ───────────────────────────────────────────────────────

describe("GET /api/elements", () => {
  it("returns empty list when no elements exist", async () => {
    vi.mocked(getElements).mockResolvedValue({ rows: [], total: 0 });

    const req = buildRequest("/api/elements");
    const res = await GET(req);
    const { status, body } = await parseResponse<{
      rows: Element[];
      total: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("passes filter params to getElements", async () => {
    vi.mocked(getElements).mockResolvedValue({ rows: [fakeElement], total: 1 });

    const req = buildRequest(
      `/api/elements?search=paint&categoryId=${CAT_ID}&unit=m2&isActive=true&page=2&limit=25`
    );
    const res = await GET(req);
    const { status, body } = await parseResponse<{
      rows: Element[];
      total: number;
      page: number;
      limit: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(25);
    expect(getElements).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({
        search: "paint",
        categoryId: CAT_ID,
        unit: "m2",
        isActive: true,
        page: 2,
        limit: 25,
      })
    );
  });

  it("parses repeated tags query params as an array", async () => {
    vi.mocked(getElements).mockResolvedValue({ rows: [], total: 0 });

    const req = buildRequest("/api/elements?tags=paint&tags=interior");
    await GET(req);

    expect(getElements).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({ tags: ["paint", "interior"] })
    );
  });

  it("returns 400 on invalid unit", async () => {
    const req = buildRequest("/api/elements?unit=not-a-unit");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 200 for architect", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getElements).mockResolvedValue({ rows: [], total: 0 });

    const req = buildRequest("/api/elements");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/elements");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/elements");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── POST /api/elements ──────────────────────────────────────────────────────

describe("POST /api/elements", () => {
  it("creates an element", async () => {
    vi.mocked(createElement).mockResolvedValue(fakeDetailed);

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "WAL-PNT-001",
        name: "Emulsion Paint",
        unit: "m2",
        unitCost: 120,
        currency: "INR",
        categoryId: CAT_ID,
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<ElementWithDetails>(res);

    expect(status).toBe(201);
    expect(body.code).toBe("WAL-PNT-001");
    expect(createElement).toHaveBeenCalledWith(
      "org-test-001",
      "user-test-001",
      expect.objectContaining({ code: "WAL-PNT-001", unit: "m2" })
    );
  });

  it("returns 409 on duplicate code", async () => {
    vi.mocked(createElement).mockRejectedValue(
      new Error("Code already exists")
    );

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "WAL-PNT-001",
        name: "Paint",
        unit: "m2",
        unitCost: 120,
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toBe("Code already exists");
  });

  it("returns 400 on invalid category", async () => {
    vi.mocked(createElement).mockRejectedValue(new Error("Category not found"));

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "FOO",
        name: "Foo",
        unit: "m2",
        unitCost: 120,
        categoryId: "00000000-0000-0000-0000-000000000000",
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = buildRequest("/api/elements", {
      method: "POST",
      body: { name: "No code" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when unit is not in allowed list", async () => {
    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "X",
        name: "X",
        unit: "bananas",
        unitCost: 10,
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when unitCost is negative", async () => {
    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "X",
        name: "X",
        unit: "m2",
        unitCost: -5,
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: { code: "X", name: "X", unit: "m2", unitCost: 10 },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── GET /api/elements/[id] ──────────────────────────────────────────────────

describe("GET /api/elements/[id]", () => {
  it("returns an element with attributes + category path", async () => {
    vi.mocked(getElementById).mockResolvedValue(fakeDetailed);

    const req = buildRequest(`/api/elements/${ELEM_ID}`);
    const res = await GET_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<ElementWithDetails>(res);

    expect(status).toBe(200);
    expect(body.id).toBe(ELEM_ID);
    expect(body.category_path).toEqual(["Finishes", "Wall Finishes"]);
  });

  it("returns 404 when element not found", async () => {
    vi.mocked(getElementById).mockResolvedValue(null);

    const req = buildRequest(`/api/elements/${ELEM_ID}`);
    const res = await GET_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}`);
    const res = await GET_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/elements/[id] ────────────────────────────────────────────────

describe("PATCH /api/elements/[id]", () => {
  it("updates element fields", async () => {
    vi.mocked(updateElement).mockResolvedValue({
      ...fakeDetailed,
      name: "New Name",
    });

    const req = buildRequest(`/api/elements/${ELEM_ID}`, {
      method: "PATCH",
      body: { name: "New Name" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<ElementWithDetails>(res);

    expect(status).toBe(200);
    expect(body.name).toBe("New Name");
  });

  it("returns 404 when element not found", async () => {
    vi.mocked(updateElement).mockResolvedValue(null);

    const req = buildRequest(`/api/elements/${ELEM_ID}`, {
      method: "PATCH",
      body: { name: "x" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 409 on duplicate code", async () => {
    vi.mocked(updateElement).mockRejectedValue(
      new Error("Code already exists")
    );

    const req = buildRequest(`/api/elements/${ELEM_ID}`, {
      method: "PATCH",
      body: { code: "DUPE" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(409);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}`, {
      method: "PATCH",
      body: { name: "x" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/elements/[id] ───────────────────────────────────────────────

describe("DELETE /api/elements/[id]", () => {
  it("soft-deletes an element", async () => {
    vi.mocked(softDeleteElement).mockResolvedValue({ deleted: true });

    const req = buildRequest(`/api/elements/${ELEM_ID}`, { method: "DELETE" });
    const res = await DELETE_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 404 when element not found or already archived", async () => {
    vi.mocked(softDeleteElement).mockResolvedValue({ deleted: false });

    const req = buildRequest(`/api/elements/${ELEM_ID}`, { method: "DELETE" });
    const res = await DELETE_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}`, { method: "DELETE" });
    const res = await DELETE_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/elements/[id]/restore ─────────────────────────────────────────

describe("POST /api/elements/[id]/restore", () => {
  it("restores an archived element", async () => {
    vi.mocked(restoreElement).mockResolvedValue({ restored: true });

    const req = buildRequest(`/api/elements/${ELEM_ID}/restore`, {
      method: "POST",
    });
    const res = await POST_RESTORE(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(restoreElement).toHaveBeenCalledWith("org-test-001", ELEM_ID);
  });

  it("returns 404 when element not found or already active", async () => {
    vi.mocked(restoreElement).mockResolvedValue({ restored: false });

    const req = buildRequest(`/api/elements/${ELEM_ID}/restore`, {
      method: "POST",
    });
    const res = await POST_RESTORE(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}/restore`, {
      method: "POST",
    });
    const res = await POST_RESTORE(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/elements/[id]/duplicate ───────────────────────────────────────

describe("POST /api/elements/[id]/duplicate", () => {
  it("duplicates an element", async () => {
    vi.mocked(duplicateElement).mockResolvedValue({
      ...fakeDetailed,
      id: "new-id",
      code: "WAL-PNT-001-copy",
    });

    const req = buildRequest(`/api/elements/${ELEM_ID}/duplicate`, {
      method: "POST",
    });
    const res = await POST_DUPLICATE(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<ElementWithDetails>(res);

    expect(status).toBe(201);
    expect(body.code).toBe("WAL-PNT-001-copy");
  });

  it("returns 404 when source element not found", async () => {
    vi.mocked(duplicateElement).mockResolvedValue(null);

    const req = buildRequest(`/api/elements/${ELEM_ID}/duplicate`, {
      method: "POST",
    });
    const res = await POST_DUPLICATE(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when duplication fails to find a unique code", async () => {
    vi.mocked(duplicateElement).mockRejectedValue(
      new Error("Could not generate unique code for duplicate")
    );

    const req = buildRequest(`/api/elements/${ELEM_ID}/duplicate`, {
      method: "POST",
    });
    const res = await POST_DUPLICATE(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}/duplicate`, {
      method: "POST",
    });
    const res = await POST_DUPLICATE(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
