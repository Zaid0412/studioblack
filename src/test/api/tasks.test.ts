import { describe, it, expect, beforeEach } from "vitest";
import {
  getTasks,
  getTaskBucketCounts,
  getMemberRole,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  validateOrgMembership,
  validateProjectInOrg,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import { GET, POST } from "@/app/api/tasks/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "@/app/api/tasks/[id]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import { vi } from "vitest";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const TASK_ID = "task-test-001";

const fakeTask = {
  id: TASK_ID,
  org_id: TEST_ORG_ID,
  project_id: null,
  phase_id: null,
  title: "Test task",
  description: "",
  status: "todo",
  priority: "medium",
  category: "general",
  created_by: TEST_USER_ID,
  assigned_to: TEST_USER_ID,
  due_date: null,
  completed_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

// ── Helpers ─────────────────────────────────────────────────────────────────

function authAsPm() {
  setupAuth(
    {
      getSession: vi.mocked(auth.api.getSession),
      listOrganizations: vi.mocked(auth.api.listOrganizations),
      listMembers: vi.mocked(auth.api.listMembers),
    },
    pmSession
  );
}

function authAsClient() {
  setupAuth(
    {
      getSession: vi.mocked(auth.api.getSession),
      listOrganizations: vi.mocked(auth.api.listOrganizations),
      listMembers: vi.mocked(auth.api.listMembers),
    },
    clientSession
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authAsPm();
  vi.mocked(getMemberRole).mockResolvedValue("owner");
  vi.mocked(validateOrgMembership).mockResolvedValue(true);
  vi.mocked(validateProjectInOrg).mockResolvedValue(true);
});

// ── GET /api/tasks ──────────────────────────────────────────────────────────

describe("GET /api/tasks", () => {
  it("returns 403 for client role", async () => {
    authAsClient();
    const req = buildRequest("/api/tasks");
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it("returns tasks with filters", async () => {
    const tasks = [fakeTask];
    vi.mocked(getTasks).mockResolvedValue({ tasks, total: 1 });
    vi.mocked(getTaskBucketCounts).mockResolvedValue({
      important: 1,
      reminders: 0,
      mentions: 0,
      tasks_for_me: 1,
      tasks_by_me: 0,
      my_requests: 0,
      my_approvals: 0,
      my_comments: 0,
      all_tasks: 1,
      all_requests: 0,
    });

    const req = buildRequest("/api/tasks", {
      searchParams: { bucket: "all_tasks", status: "todo" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse<{
      tasks: unknown[];
      counts: Record<string, number>;
      total: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.tasks).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.counts).toBeDefined();
  });

  it("returns empty results", async () => {
    vi.mocked(getTasks).mockResolvedValue({ tasks: [], total: 0 });
    vi.mocked(getTaskBucketCounts).mockResolvedValue({});

    const req = buildRequest("/api/tasks");
    const res = await GET(req);
    const { status, body } = await parseResponse<{
      tasks: unknown[];
      total: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.tasks).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

// ── POST /api/tasks ─────────────────────────────────────────────────────────

describe("POST /api/tasks", () => {
  it("returns 403 for client role", async () => {
    authAsClient();
    const req = buildRequest("/api/tasks", {
      method: "POST",
      body: { title: "New task" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it("creates task with valid body", async () => {
    const created = { ...fakeTask, id: "task-new-001", title: "New task" };
    vi.mocked(createTask).mockResolvedValue(created);

    const req = buildRequest("/api/tasks", {
      method: "POST",
      body: { title: "New task" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ id: string; title: string }>(
      res
    );

    expect(status).toBe(201);
    expect(body.title).toBe("New task");
    expect(createTask).toHaveBeenCalledOnce();
  });

  it("returns 400 on invalid body", async () => {
    const req = buildRequest("/api/tasks", {
      method: "POST",
      body: { title: "" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });
});

// ── GET /api/tasks/[id] ────────────────────────────────────────────────────

describe("GET /api/tasks/[id]", () => {
  it("returns task when found", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);

    const req = buildRequest(`/api/tasks/${TASK_ID}`);
    const res = await GET_BY_ID(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ id: string }>(res);

    expect(status).toBe(200);
    expect(body.id).toBe(TASK_ID);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);

    const req = buildRequest(`/api/tasks/${TASK_ID}`);
    const res = await GET_BY_ID(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── PATCH /api/tasks/[id] ──────────────────────────────────────────────────

describe("PATCH /api/tasks/[id]", () => {
  it("updates task successfully", async () => {
    const updated = { ...fakeTask, title: "Updated title" };
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(updateTask).mockResolvedValue(updated);

    const req = buildRequest(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      body: { title: "Updated title" },
    });
    const res = await PATCH(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ title: string }>(res);

    expect(status).toBe(200);
    expect(body.title).toBe("Updated title");
    expect(updateTask).toHaveBeenCalledOnce();
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);

    const req = buildRequest(`/api/tasks/${TASK_ID}`, {
      method: "PATCH",
      body: { title: "Updated title" },
    });
    const res = await PATCH(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

// ── DELETE /api/tasks/[id] ─────────────────────────────────────────────────

describe("DELETE /api/tasks/[id]", () => {
  it("deletes task as creator", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(deleteTask).mockResolvedValue(undefined);

    const req = buildRequest(`/api/tasks/${TASK_ID}`, { method: "DELETE" });
    const res = await DELETE(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteTask).toHaveBeenCalledWith(TASK_ID);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);

    const req = buildRequest(`/api/tasks/${TASK_ID}`, { method: "DELETE" });
    const res = await DELETE(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});
