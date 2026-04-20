import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCategoryTree,
  buildCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/element-categories/route";
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/element-categories/[id]/route";
import { PATCH as PATCH_REORDER } from "@/app/api/element-categories/reorder/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { ElementCategory } from "@/types";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const CAT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const CHILD_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const GRANDCHILD_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const fakeCategory: ElementCategory = {
  id: CAT_ID,
  name: "Finishes",
  parent_id: null,
  level: 1,
  code_prefix: "FIN",
  sort_order: 0,
  icon: "paint-bucket",
  color: "#FF5733",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const fakeChild: ElementCategory = {
  ...fakeCategory,
  id: CHILD_ID,
  name: "Wall Finishes",
  parent_id: CAT_ID,
  level: 2,
  code_prefix: "WF",
  sort_order: 0,
};

const fakeGrandchild: ElementCategory = {
  ...fakeCategory,
  id: GRANDCHILD_ID,
  name: "Paint",
  parent_id: CHILD_ID,
  level: 3,
  code_prefix: "PT",
  sort_order: 0,
};

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

// ── GET /api/element-categories ─────────────────────────────────────────────

describe("GET /api/element-categories", () => {
  it("returns empty tree when no categories exist", async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    vi.mocked(buildCategoryTree).mockReturnValue([]);

    const req = buildRequest("/api/element-categories");
    const res = await GET(req);
    const { status, body } = await parseResponse<{ tree: unknown[] }>(res);

    expect(status).toBe(200);
    expect(body.tree).toEqual([]);
  });

  it("returns nested tree with 3 levels", async () => {
    const rows = [fakeCategory, fakeChild, fakeGrandchild];
    vi.mocked(getCategoryTree).mockResolvedValue(rows);
    vi.mocked(buildCategoryTree).mockReturnValue([
      {
        ...fakeCategory,
        children: [
          {
            ...fakeChild,
            children: [{ ...fakeGrandchild, children: [] }],
          },
        ],
      },
    ]);

    const req = buildRequest("/api/element-categories");
    const res = await GET(req);
    const { status, body } = await parseResponse<{ tree: unknown[] }>(res);

    expect(status).toBe(200);
    expect(body.tree).toHaveLength(1);
  });

  it("returns 200 for architect role", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    vi.mocked(buildCategoryTree).mockReturnValue([]);

    const req = buildRequest("/api/element-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/element-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/element-categories");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── POST /api/element-categories ────────────────────────────────────────────

describe("POST /api/element-categories", () => {
  it("creates a root category", async () => {
    const created = { ...fakeCategory, id: "new-cat-001" };
    vi.mocked(createCategory).mockResolvedValue(created);

    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "Finishes", codePrefix: "FIN", color: "#FF5733" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<ElementCategory>(res);

    expect(status).toBe(201);
    expect(body.name).toBe("Finishes");
  });

  it("creates a child category with parentId", async () => {
    vi.mocked(createCategory).mockResolvedValue(fakeChild);

    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "Wall Finishes", parentId: CAT_ID },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<ElementCategory>(res);

    expect(status).toBe(201);
    expect(body.parent_id).toBe(CAT_ID);
  });

  it("returns 400 when parent is at max depth", async () => {
    vi.mocked(createCategory).mockRejectedValue(
      new Error("Maximum nesting depth reached")
    );

    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "Too Deep", parentId: GRANDCHILD_ID },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("depth");
  });

  it("returns 400 when parent doesn't exist", async () => {
    vi.mocked(createCategory).mockRejectedValue(
      new Error("Parent category not found")
    );

    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: {
        name: "Orphan",
        parentId: "f47ac10b-58cc-4372-a567-000000000000",
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when color is invalid", async () => {
    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "Test", color: "red" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/element-categories", {
      method: "POST",
      body: { name: "Finishes" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/element-categories/[id] ──────────────────────────────────────

describe("PATCH /api/element-categories/[id]", () => {
  it("updates category name", async () => {
    const updated = { ...fakeCategory, name: "Updated Finishes" };
    vi.mocked(updateCategory).mockResolvedValue(updated);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Updated Finishes" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status, body } = await parseResponse<ElementCategory>(res);

    expect(status).toBe(200);
    expect(body.name).toBe("Updated Finishes");
  });

  it("updates color, icon, isActive", async () => {
    const updated = {
      ...fakeCategory,
      color: "#000000",
      icon: "star",
      is_active: false,
    };
    vi.mocked(updateCategory).mockResolvedValue(updated);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { color: "#000000", icon: "star", isActive: false },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status, body } = await parseResponse<ElementCategory>(res);

    expect(status).toBe(200);
    expect(body.is_active).toBe(false);
  });

  it("returns 404 when category not found", async () => {
    vi.mocked(updateCategory).mockResolvedValue(null);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Nope" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when no valid fields provided", async () => {
    vi.mocked(updateCategory).mockResolvedValue(null);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "PATCH",
      body: {},
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "PATCH",
      body: { name: "Nope" },
    });
    const res = await PATCH_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/element-categories/[id] ─────────────────────────────────────

describe("DELETE /api/element-categories/[id]", () => {
  it("deletes a leaf category", async () => {
    vi.mocked(deleteCategory).mockResolvedValue({ deleted: true });

    const req = buildRequest(`/api/element-categories/${GRANDCHILD_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: GRANDCHILD_ID }));
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 409 when category has children", async () => {
    vi.mocked(deleteCategory).mockResolvedValue({
      deleted: false,
      error: "Category has children. Remove or move them first.",
    });

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toContain("children");
  });

  it("returns 404 when category not found", async () => {
    vi.mocked(deleteCategory).mockResolvedValue({
      deleted: false,
      error: "Category not found",
    });

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/element-categories/${CAT_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(req, buildParams({ id: CAT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/element-categories/reorder ───────────────────────────────────

describe("PATCH /api/element-categories/reorder", () => {
  it("reorders root categories", async () => {
    vi.mocked(reorderCategories).mockResolvedValue(undefined);

    const orderedIds = [CHILD_ID, CAT_ID];
    const req = buildRequest("/api/element-categories/reorder", {
      method: "PATCH",
      body: { parentId: null, orderedIds },
    });
    const res = await PATCH_REORDER(req);
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(reorderCategories).toHaveBeenCalledWith(null, orderedIds);
  });

  it("reorders children within a parent", async () => {
    vi.mocked(reorderCategories).mockResolvedValue(undefined);

    const orderedIds = [GRANDCHILD_ID, CHILD_ID];
    const req = buildRequest("/api/element-categories/reorder", {
      method: "PATCH",
      body: { parentId: CAT_ID, orderedIds },
    });
    const res = await PATCH_REORDER(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(reorderCategories).toHaveBeenCalledWith(CAT_ID, orderedIds);
  });

  it("returns 400 when orderedIds is empty", async () => {
    const req = buildRequest("/api/element-categories/reorder", {
      method: "PATCH",
      body: { parentId: null, orderedIds: [] },
    });
    const res = await PATCH_REORDER(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/element-categories/reorder", {
      method: "PATCH",
      body: { parentId: null, orderedIds: [CAT_ID] },
    });
    const res = await PATCH_REORDER(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest("/api/element-categories/reorder", {
      method: "PATCH",
      body: { parentId: null, orderedIds: [CAT_ID] },
    });
    const res = await PATCH_REORDER(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
