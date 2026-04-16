import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  verifyTaskAccess,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/tasks/[id]/checklist/route";
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/tasks/[id]/checklist/[itemId]/route";
import { PATCH as PATCH_REORDER } from "@/app/api/tasks/[id]/checklist/reorder/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const TASK_ID = "task-cl-001";
const ITEM_ID = "item-001";

const fakeItem = {
  id: ITEM_ID,
  task_id: TASK_ID,
  title: "Buy paint",
  is_done: false,
  position: 0,
  created_at: "2024-01-01T00:00:00Z",
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(verifyTaskAccess).mockResolvedValue(true);
});

// ── GET /api/tasks/[id]/checklist ───────────────────────────────────────────

describe("GET /api/tasks/[id]/checklist", () => {
  it("returns checklist items", async () => {
    vi.mocked(getChecklistItems).mockResolvedValue([fakeItem]);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist`);
    const res = await GET(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<(typeof fakeItem)[]>(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist`);
    const res = await GET(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/tasks/[id]/checklist ──────────────────────────────────────────

describe("POST /api/tasks/[id]/checklist", () => {
  it("creates a checklist item", async () => {
    const created = { ...fakeItem, id: "item-new-001" };
    vi.mocked(createChecklistItem).mockResolvedValue(created);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist`, {
      method: "POST",
      body: { title: "Buy paint" },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ id: string }>(res);

    expect(status).toBe(201);
    expect(body.id).toBe("item-new-001");
    expect(createChecklistItem).toHaveBeenCalledWith(TASK_ID, "Buy paint");
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist`, {
      method: "POST",
      body: { title: "Buy paint" },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 on invalid body", async () => {
    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist`, {
      method: "POST",
      body: { title: "" },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

// ── PATCH /api/tasks/[id]/checklist/[itemId] ────────────────────────────────

describe("PATCH /api/tasks/[id]/checklist/[itemId]", () => {
  it("updates a checklist item", async () => {
    const updated = { ...fakeItem, is_done: true };
    vi.mocked(updateChecklistItem).mockResolvedValue(updated);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/${ITEM_ID}`, {
      method: "PATCH",
      body: { is_done: true },
    });
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: TASK_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ is_done: boolean }>(res);

    expect(status).toBe(200);
    expect(body.is_done).toBe(true);
    expect(updateChecklistItem).toHaveBeenCalledWith(ITEM_ID, TASK_ID, {
      title: undefined,
      is_done: true,
      position: undefined,
    });
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/${ITEM_ID}`, {
      method: "PATCH",
      body: { is_done: true },
    });
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: TASK_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/tasks/[id]/checklist/[itemId] ───────────────────────────────

describe("DELETE /api/tasks/[id]/checklist/[itemId]", () => {
  it("deletes a checklist item", async () => {
    vi.mocked(deleteChecklistItem).mockResolvedValue(true);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/${ITEM_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: TASK_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteChecklistItem).toHaveBeenCalledWith(ITEM_ID, TASK_ID);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/${ITEM_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: TASK_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/tasks/[id]/checklist/reorder ─────────────────────────────────

describe("PATCH /api/tasks/[id]/checklist/reorder", () => {
  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when task not accessible", async () => {
    vi.mocked(verifyTaskAccess).mockResolvedValueOnce(false);

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 400 for empty orderedIds", async () => {
    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds: [] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for missing orderedIds", async () => {
    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: {},
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("reorders checklist items", async () => {
    vi.mocked(reorderChecklistItems).mockResolvedValue(undefined);

    const orderedIds = [
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    ];
    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(reorderChecklistItems).toHaveBeenCalledWith(TASK_ID, orderedIds);
  });

  it("returns 500 when reorder throws", async () => {
    vi.mocked(reorderChecklistItems).mockRejectedValueOnce(
      new Error("DB error")
    );

    const req = buildRequest(`/api/tasks/${TASK_ID}/checklist/reorder`, {
      method: "PATCH",
      body: { orderedIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Failed to reorder" });
  });
});
