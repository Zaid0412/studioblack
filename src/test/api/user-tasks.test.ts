import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTasksByAssignee,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { GET } from "@/app/api/user/tasks/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const sampleTasks = [
  {
    id: "task-1",
    title: "Fix bug",
    status: "todo",
    assigned_to: TEST_USER_ID,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "task-2",
    title: "Write docs",
    status: "in_progress",
    assigned_to: TEST_USER_ID,
    created_at: "2024-01-02T00:00:00Z",
  },
];

// ── GET /api/user/tasks ─────────────────────────────────────────────────────

describe("GET /api/user/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/user/tasks");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for client role", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const req = buildRequest("/api/user/tasks");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns tasks for authenticated user", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getTasksByAssignee).mockResolvedValue(sampleTasks as never);

    const req = buildRequest("/api/user/tasks");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(sampleTasks);
    expect(getTasksByAssignee).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns empty array when user has no tasks", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getTasksByAssignee).mockResolvedValue([] as never);

    const req = buildRequest("/api/user/tasks");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});
