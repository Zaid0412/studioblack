import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/tasks/[id]/checklist/reorder/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const { reorderChecklistItems, verifyTaskAccess, getOrgRole } =
  await import("@/lib/queries");

const PARAMS = buildParams({ id: "task-1" });

const UUID1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UUID2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const UUID3 = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

describe("PATCH /api/tasks/[id]/checklist/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(verifyTaskAccess).mockResolvedValue(true);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: { orderedIds: [UUID1] },
    });
    const res = await PATCH(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when task not accessible", async () => {
    vi.mocked(verifyTaskAccess).mockResolvedValueOnce(false);

    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: { orderedIds: [UUID1] },
    });
    const res = await PATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 400 for invalid body (empty orderedIds)", async () => {
    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: { orderedIds: [] },
    });
    const res = await PATCH(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for missing orderedIds", async () => {
    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: {},
    });
    const res = await PATCH(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("reorders successfully", async () => {
    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: { orderedIds: [UUID1, UUID2, UUID3] },
    });
    const res = await PATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(reorderChecklistItems).toHaveBeenCalledWith("task-1", [
      UUID1,
      UUID2,
      UUID3,
    ]);
  });

  it("returns 500 when reorder throws", async () => {
    vi.mocked(reorderChecklistItems).mockRejectedValueOnce(
      new Error("DB error")
    );

    const req = buildRequest("/api/tasks/task-1/checklist/reorder", {
      method: "PATCH",
      body: { orderedIds: [UUID1] },
    });
    const res = await PATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Failed to reorder" });
  });
});
