import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getElements,
  getElementById,
  findSimilarElements,
  promoteElement,
  createElement,
  updateElement,
  softDeleteElement,
  restoreElement,
  duplicateElement,
  getVersionHistory,
  getMemberRole,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/elements/route";
import {
  GET as GET_ITEM,
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/elements/[id]/route";
import { POST as POST_DUPLICATE } from "@/app/api/elements/[id]/duplicate/route";
import { POST as POST_RESTORE } from "@/app/api/elements/[id]/restore/route";
import { GET as GET_VERSIONS } from "@/app/api/elements/[id]/versions/route";
import { GET as GET_SIMILAR } from "@/app/api/elements/similar/route";
import { POST as POST_PROMOTE } from "@/app/api/elements/[id]/promote/route";
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
  version_group: "11111111-2222-3333-4444-555555555555",
  version_number: 1,
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

  it("forwards the element_type filter to getElements", async () => {
    vi.mocked(getElements).mockResolvedValue({ rows: [], total: 0 });
    await GET(buildRequest("/api/elements?type=custom"));
    expect(getElements).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({ type: "custom" })
    );
  });

  it("rejects an invalid element_type", async () => {
    const res = await GET(buildRequest("/api/elements?type=bogus"));
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("returns 400 on invalid unit", async () => {
    const req = buildRequest("/api/elements?unit=not-a-unit");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 200 for architect", async () => {
    setupAuth(mocks.auth, architectSession);
    // withAuth re-derives the effective role from getMemberRole — without this
    // override the global mock returns "owner", which maps to "pm", and the
    // architect branch is never exercised.
    vi.mocked(getMemberRole).mockResolvedValue("member");
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

describe("GET /api/elements/similar", () => {
  it("400s when categoryId or q is missing", async () => {
    const res = await GET_SIMILAR(buildRequest("/api/elements/similar?q=tile"));
    expect((await parseResponse(res)).status).toBe(400);
    expect(findSimilarElements).not.toHaveBeenCalled();
  });

  it("returns matches and forwards categoryId + description + tags", async () => {
    vi.mocked(findSimilarElements).mockResolvedValueOnce([
      { ...fakeElement, similarity: 0.6 },
    ]);
    const res = await GET_SIMILAR(
      buildRequest(
        `/api/elements/similar?categoryId=${CAT_ID}&q=tile&tags=matte`
      )
    );
    const { status, body } = await parseResponse<{ rows: Element[] }>(res);

    expect(status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(findSimilarElements).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({
        categoryId: CAT_ID,
        description: "tile",
        tags: ["matte"],
      })
    );
  });
});

describe("POST /api/elements/[id]/promote", () => {
  it("promotes a Custom element and returns it", async () => {
    vi.mocked(promoteElement).mockResolvedValueOnce({
      ...fakeElement,
      element_type: "company_standard",
    });
    const res = await POST_PROMOTE(
      buildRequest(`/api/elements/${ELEM_ID}/promote`, { method: "POST" }),
      buildParams({ id: ELEM_ID })
    );
    const { status, body } = await parseResponse<Element>(res);

    expect(status).toBe(200);
    expect(body.element_type).toBe("company_standard");
    expect(promoteElement).toHaveBeenCalledWith("org-test-001", ELEM_ID);
  });

  it("404s when the element isn't Custom (or not found)", async () => {
    vi.mocked(promoteElement).mockResolvedValueOnce(null);
    const res = await POST_PROMOTE(
      buildRequest(`/api/elements/${ELEM_ID}/promote`, { method: "POST" }),
      buildParams({ id: ELEM_ID })
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("POST /api/elements", () => {
  it("creates an element", async () => {
    vi.mocked(createElement).mockResolvedValue(fakeDetailed);

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
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
      expect.objectContaining({ unit: "m2", categoryId: CAT_ID })
    );
  });

  // The code is server-assigned from the category — a client that sends one
  // must not be able to choose it.
  it("ignores a client-supplied code on create", async () => {
    vi.mocked(createElement).mockResolvedValue(fakeDetailed);

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        code: "HACK-9999",
        name: "Emulsion Paint",
        categoryId: CAT_ID,
        unit: "m2",
        unitCost: 120,
      },
    });
    await POST(req);

    expect(createElement).toHaveBeenCalledWith(
      "org-test-001",
      "user-test-001",
      expect.not.objectContaining({ code: expect.anything() })
    );
  });

  // Codes are generated from a counter seeded past every existing code, so a
  // collision means the counter is wrong — surface it rather than swallow it.
  it("returns 400 when no free code can be generated", async () => {
    vi.mocked(createElement).mockRejectedValue(
      new Error("Could not generate a free element code for KIT")
    );

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        name: "Paint",
        categoryId: CAT_ID,
        unit: "m2",
        unitCost: 120,
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Could not generate a free element code for KIT");
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

  // An element must sit under a Service Area. The schema can only see that a
  // UUID was sent, so the level check lives in requireServiceArea — and it is
  // the same query that rejects another org's category id.
  it("returns 400 without a category — the schema requires one", async () => {
    const req = buildRequest("/api/elements", {
      method: "POST",
      body: { name: "Paint", unit: "m2", unitCost: 120 },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(createElement).not.toHaveBeenCalled();
  });

  it("returns 400 when the category is not a Service Area", async () => {
    vi.mocked(createElement).mockRejectedValue(
      new Error("Category must be a Service Area")
    );

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        name: "Paint",
        categoryId: CAT_ID,
        unit: "m2",
        unitCost: 120,
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Category must be a Service Area");
  });

  it("returns 400 when the category belongs to another org", async () => {
    // requireServiceArea scopes its lookup to the org, so a foreign id reads as
    // "not found" rather than leaking the other org's category.
    vi.mocked(createElement).mockRejectedValue(new Error("Category not found"));

    const req = buildRequest("/api/elements", {
      method: "POST",
      body: {
        name: "Paint",
        categoryId: "b1ffcd00-ad1c-4f09-bb7e-7ccace491b22",
        unit: "m2",
        unitCost: 120,
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Category not found");
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

  // The code is assigned once at creation and is the join key for the Excel
  // import — a PATCH must not be able to move it.
  it("ignores a code in the body", async () => {
    vi.mocked(updateElement).mockResolvedValue(fakeDetailed);

    const req = buildRequest(`/api/elements/${ELEM_ID}`, {
      method: "PATCH",
      body: { name: "Renamed", code: "HACK-9999" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(updateElement).toHaveBeenCalledWith(
      "org-test-001",
      ELEM_ID,
      expect.not.objectContaining({ code: expect.anything() })
    );
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
    // Route must forward the anchor element id — query archives every row that
    // shares this anchor's version_group, so archiving v3 when v5 is latest
    // now hides the whole group instead of leaving a stale active latest.
    expect(softDeleteElement).toHaveBeenCalledWith("org-test-001", ELEM_ID);
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

// ── GET /api/elements/[id]/versions ─────────────────────────────────────────

describe("GET /api/elements/[id]/versions", () => {
  it("returns versions newest first", async () => {
    const v2: Element = {
      ...fakeElement,
      id: "v2-id",
      version_number: 2,
      unit_cost: "130.00",
    };
    const v1: Element = { ...fakeElement, id: "v1-id", version_number: 1 };
    vi.mocked(getVersionHistory).mockResolvedValue([v2, v1]);

    const req = buildRequest(`/api/elements/${ELEM_ID}/versions`);
    const res = await GET_VERSIONS(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<{ versions: Element[] }>(res);

    expect(status).toBe(200);
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].version_number).toBe(2);
    expect(getVersionHistory).toHaveBeenCalledWith("org-test-001", ELEM_ID);
  });

  it("returns 200 with single-version history (happy path)", async () => {
    // Disambiguates the 404 branch: an anchor row exists but has no siblings.
    // getVersionHistory returns just the anchor itself → must be 200, not 404.
    vi.mocked(getVersionHistory).mockResolvedValue([fakeElement]);

    const req = buildRequest(`/api/elements/${ELEM_ID}/versions`);
    const res = await GET_VERSIONS(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<{ versions: Element[] }>(res);

    expect(status).toBe(200);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].version_number).toBe(1);
  });

  it("returns 404 when element not found", async () => {
    vi.mocked(getVersionHistory).mockResolvedValue([]);

    const req = buildRequest(`/api/elements/${ELEM_ID}/versions`);
    const res = await GET_VERSIONS(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/elements/${ELEM_ID}/versions`);
    const res = await GET_VERSIONS(req, buildParams({ id: ELEM_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/elements/[id]/duplicate ───────────────────────────────────────

describe("POST /api/elements/[id]/duplicate", () => {
  it("duplicates an element", async () => {
    // The copy gets the next code in its category's sequence, not a -copy suffix.
    vi.mocked(duplicateElement).mockResolvedValue({
      ...fakeDetailed,
      id: "new-id",
      code: "WAL-PNT-0002",
    });

    const req = buildRequest(`/api/elements/${ELEM_ID}/duplicate`, {
      method: "POST",
    });
    const res = await POST_DUPLICATE(req, buildParams({ id: ELEM_ID }));
    const { status, body } = await parseResponse<ElementWithDetails>(res);

    expect(status).toBe(201);
    expect(body.code).toBe("WAL-PNT-0002");
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
      new Error("Could not generate a free element code for WAL-PNT")
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
