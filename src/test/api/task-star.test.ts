import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyTaskAccess,
  toggleTaskStar,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST } from "@/app/api/tasks/[id]/star/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
  TEST_ORG_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const TASK_ID = "task-star-001";

// ── POST /api/tasks/[id]/star ───────────────────────────────────────────────

describe("POST /api/tasks/[id]/star", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/tasks/${TASK_ID}/star`, { method: "POST" });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for client role", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const req = buildRequest(`/api/tasks/${TASK_ID}/star`, { method: "POST" });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when task not found in org", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(verifyTaskAccess).mockResolvedValue(false as never);

    const req = buildRequest(`/api/tasks/${TASK_ID}/star`, { method: "POST" });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
    expect(verifyTaskAccess).toHaveBeenCalledWith(TASK_ID, TEST_ORG_ID);
  });

  it("toggles star and returns result", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(verifyTaskAccess).mockResolvedValue(true as never);
    const starResult = { starred: true };
    vi.mocked(toggleTaskStar).mockResolvedValue(starResult as never);

    const req = buildRequest(`/api/tasks/${TASK_ID}/star`, { method: "POST" });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(starResult);
    expect(toggleTaskStar).toHaveBeenCalledWith(TEST_USER_ID, TASK_ID);
  });

  it("toggles star off (unstar)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(verifyTaskAccess).mockResolvedValue(true as never);
    const starResult = { starred: false };
    vi.mocked(toggleTaskStar).mockResolvedValue(starResult as never);

    const req = buildRequest(`/api/tasks/${TASK_ID}/star`, { method: "POST" });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(starResult);
  });
});
