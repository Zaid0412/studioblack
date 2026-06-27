import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getVendorCategoryTree,
  buildVendorCategoryTree,
  createVendorCategory,
  updateVendorCategory,
  deleteVendorCategory,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/vendor-categories/route";
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/vendor-categories/[id]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { VendorCategory } from "@/types";

const CAT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const CHILD_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const GRANDCHILD_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const fakeCategory: VendorCategory = {
  id: CAT_ID,
  org_id: "org-test-001",
  name: "Joinery",
  parent_id: null,
  level: 1,
  code: "JOIN",
  sort_order: 0,
  icon: null,
  color: "#FF5733",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const fakeChild: VendorCategory = {
  ...fakeCategory,
  id: CHILD_ID,
  name: "Wardrobes",
  parent_id: CAT_ID,
  level: 2,
  code: "WRD",
};

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

// ── GET /api/vendor-categories ──────────────────────────────────────────────

describe("GET /api/vendor-categories", () => {
  it("returns empty tree when none exist", async () => {
    vi.mocked(getVendorCategoryTree).mockResolvedValue([]);
    vi.mocked(buildVendorCategoryTree).mockReturnValue([]);

    const req = buildRequest("/api/vendor-categories");
    const res = await GET(req);
    const { status, body } = await parseResponse<{ tree: unknown[] }>(res);

    expect(status).toBe(200);
    expect(body.tree).toEqual([]);
  });

  it("returns nested tree", async () => {
    vi.mocked(getVendorCategoryTree).mockResolvedValue([
      fakeCategory,
      fakeChild,
    ]);
    vi.mocked(buildVendorCategoryTree).mockReturnValue([
      { ...fakeCategory, children: [{ ...fakeChild, children: [] }] },
    ]);

    const req = buildRequest("/api/vendor-categories");
    const res = await GET(req);
    const { status, body } = await parseResponse<{ tree: unknown[] }>(res);

    expect(status).toBe(200);
    expect(body.tree).toHaveLength(1);
  });

  it("returns 200 for architect role", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getVendorCategoryTree).mockResolvedValue([]);
    vi.mocked(buildVendorCategoryTree).mockReturnValue([]);

    const req = buildRequest("/api/vendor-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/vendor-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/vendor-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── POST /api/vendor-categories ─────────────────────────────────────────────

describe("POST /api/vendor-categories", () => {
  it("creates a root category", async () => {
    vi.mocked(createVendorCategory).mockResolvedValue(fakeCategory);

    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "Joinery", code: "JOIN", color: "#FF5733" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<VendorCategory>(res);

    expect(status).toBe(201);
    expect(body.name).toBe("Joinery");
  });

  it("creates a child category with parentId", async () => {
    vi.mocked(createVendorCategory).mockResolvedValue(fakeChild);

    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "Wardrobes", parentId: CAT_ID },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<VendorCategory>(res);

    expect(status).toBe(201);
    expect(body.parent_id).toBe(CAT_ID);
  });

  it("returns 400 when parent is at max depth", async () => {
    vi.mocked(createVendorCategory).mockRejectedValue(
      new Error("Maximum nesting depth reached")
    );

    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "Too Deep", parentId: GRANDCHILD_ID },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("depth");
  });

  it("returns 400 when name is empty", async () => {
    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when color is invalid", async () => {
    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "Test", color: "red" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/vendor-categories", {
      method: "POST",
      body: { name: "Joinery" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/vendor-categories/[id] ───────────────────────────────────────

describe("PATCH /api/vendor-categories/[id]", () => {
  it("updates category name", async () => {
    vi.mocked(updateVendorCategory).mockResolvedValue({
      ...fakeCategory,
      name: "Joinery & Carpentry",
    });

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Joinery & Carpentry" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status, body } = await parseResponse<VendorCategory>(res);

    expect(status).toBe(200);
    expect(body.name).toBe("Joinery & Carpentry");
  });

  it("returns 404 when category not found", async () => {
    vi.mocked(updateVendorCategory).mockResolvedValue(null);

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Nope" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Nope" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/vendor-categories/[id] ──────────────────────────────────────

describe("DELETE /api/vendor-categories/[id]", () => {
  it("deletes a leaf category", async () => {
    vi.mocked(deleteVendorCategory).mockResolvedValue({ deleted: true });

    const req = buildRequest(`/api/vendor-categories/${CHILD_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CHILD_ID }));
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 409 when category has children", async () => {
    vi.mocked(deleteVendorCategory).mockResolvedValue({
      deleted: false,
      error: "Category has children. Remove or move them first.",
    });

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toContain("children");
  });

  it("returns 404 when category not found", async () => {
    vi.mocked(deleteVendorCategory).mockResolvedValue({
      deleted: false,
      error: "Category not found",
    });

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/vendor-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
