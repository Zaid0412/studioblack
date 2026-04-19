import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPhaseTasks,
  verifyPhaseOwnership,
  verifyTaskOwnership,
  createPhaseTask,
  updatePhaseTask,
  getTasksPendingReview,
  markPhaseTaskForReview,
  getProjectReviewInfo,
  getPhaseTaskPendingReview,
  updatePhaseTaskReviewStatus,
  getOrgRole,
  hasProjectAccess,
  createComment,
} from "@/lib/queries";
import { GET, POST, PATCH } from "@/app/api/projects/[id]/tasks/route";
import { GET as GET_PENDING } from "@/app/api/projects/[id]/tasks/pending-review/route";
import { POST as POST_REQUEST_REVIEW } from "@/app/api/projects/[id]/tasks/[taskId]/request-review/route";
import { POST as POST_REVIEW } from "@/app/api/projects/[id]/tasks/[taskId]/review/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const PHASE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const TASK_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

const sampleTask = {
  id: TASK_ID,
  phase_id: PHASE_ID,
  title: "Design review",
  description: "Review the layout",
  status: "todo",
  assigned_to: null,
  due_date: null,
  requires_client_review: false,
  created_at: "2024-06-01T00:00:00.000Z",
};

const validCreateBody = {
  phaseId: PHASE_ID,
  title: "New task",
};

const validUpdateBody = {
  taskId: TASK_ID,
  title: "Updated task",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Set up auth as a client user (no org role, project access via client_email). */
function setupClientAuth() {
  const session = mockSession({ role: "client" });
  setupAuth(mocks.auth, session);
  vi.mocked(getOrgRole).mockResolvedValue(null as never);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  return session;
}

/** Set up auth as a PM (owner). */
function setupPmAuth() {
  const session = mockSession();
  setupAuth(mocks.auth, session);
  return session;
}

// ── GET /api/projects/[id]/tasks ────────────────────────────────────────────

describe("GET /api/projects/[id]/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      searchParams: { phaseId: PHASE_ID },
    });
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns tasks for a phase", async () => {
    setupPmAuth();
    vi.mocked(verifyPhaseOwnership).mockResolvedValue(true as never);
    vi.mocked(getPhaseTasks).mockResolvedValue([sampleTask] as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      searchParams: { phaseId: PHASE_ID },
    });
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleTask]);
    expect(getPhaseTasks).toHaveBeenCalledWith(PHASE_ID, PROJECT_ID);
  });

  it("returns 400 when phaseId is missing", async () => {
    setupPmAuth();

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "phaseId is required" });
  });

  it("returns 404 when phase does not belong to project", async () => {
    setupPmAuth();
    vi.mocked(verifyPhaseOwnership).mockResolvedValue(false as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      searchParams: { phaseId: "phase-unknown" },
    });
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Phase not found in this project" });
  });
});

// ── POST /api/projects/[id]/tasks ───────────────────────────────────────────

describe("POST /api/projects/[id]/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates task with valid body, returns 201", async () => {
    setupPmAuth();
    vi.mocked(verifyPhaseOwnership).mockResolvedValue(true as never);
    vi.mocked(createPhaseTask).mockResolvedValue(sampleTask as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(sampleTask);
    expect(createPhaseTask).toHaveBeenCalledWith(
      expect.objectContaining({
        phaseId: PHASE_ID,
        title: "New task",
      })
    );
  });

  it("client is blocked (403)", async () => {
    setupClientAuth();

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 on invalid body (missing title)", async () => {
    setupPmAuth();

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "POST",
      body: { phaseId: PHASE_ID },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

// ── PATCH /api/projects/[id]/tasks ──────────────────────────────────────────

describe("PATCH /api/projects/[id]/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates task with valid body", async () => {
    setupPmAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true as never);
    const updated = { ...sampleTask, title: "Updated task" };
    vi.mocked(updatePhaseTask).mockResolvedValue(updated as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "PATCH",
      body: validUpdateBody,
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updated);
    expect(updatePhaseTask).toHaveBeenCalledWith(TASK_ID, expect.any(Object));
  });

  it("client is blocked (403)", async () => {
    setupClientAuth();

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "PATCH",
      body: validUpdateBody,
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when task does not belong to project", async () => {
    setupPmAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(false as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/tasks`, {
      method: "PATCH",
      body: validUpdateBody,
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Task not found in this project" });
  });
});

// ── GET /api/projects/[id]/tasks/pending-review ─────────────────────────────

describe("GET /api/projects/[id]/tasks/pending-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending-review tasks", async () => {
    setupPmAuth();
    const pending = [{ ...sampleTask, status: "pending_review" }];
    vi.mocked(getTasksPendingReview).mockResolvedValue(pending as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/pending-review`
    );
    const res = await GET_PENDING(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(pending);
    expect(getTasksPendingReview).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/pending-review`
    );
    const res = await GET_PENDING(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── POST /api/projects/[id]/tasks/[taskId]/request-review ───────────────────

describe("POST /api/projects/[id]/tasks/[taskId]/request-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks task for review", async () => {
    setupPmAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true as never);
    const reviewed = { ...sampleTask, status: "pending_review" };
    vi.mocked(markPhaseTaskForReview).mockResolvedValue(reviewed as never);
    vi.mocked(getProjectReviewInfo).mockResolvedValue({
      name: "Test Project",
      client_email: "client@test.com",
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/request-review`,
      { method: "POST" }
    );
    const res = await POST_REQUEST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(reviewed);
    expect(markPhaseTaskForReview).toHaveBeenCalledWith(TASK_ID);
  });

  it("client is blocked (403)", async () => {
    setupClientAuth();

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/request-review`,
      { method: "POST" }
    );
    const res = await POST_REQUEST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when task does not belong to project", async () => {
    setupPmAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(false as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/request-review`,
      { method: "POST" }
    );
    const res = await POST_REQUEST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Task not found in this project" });
  });
});

// ── POST /api/projects/[id]/tasks/[taskId]/review ───────────────────────────

describe("POST /api/projects/[id]/tasks/[taskId]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("client submits approval review", async () => {
    setupClientAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true as never);
    const pending = {
      ...sampleTask,
      status: "pending_review",
      phase_id: PHASE_ID,
      assigned_to: "user-arch-1",
    };
    vi.mocked(getPhaseTaskPendingReview).mockResolvedValue(pending as never);
    const approved = {
      ...sampleTask,
      status: "approved",
      title: "Design review",
    };
    vi.mocked(updatePhaseTaskReviewStatus).mockResolvedValue(approved as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/review`,
      {
        method: "POST",
        body: { action: "approved", comment: "Looks great" },
      }
    );
    const res = await POST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(approved);
    expect(updatePhaseTaskReviewStatus).toHaveBeenCalledWith(
      TASK_ID,
      "approved"
    );
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        phaseId: PHASE_ID,
        taskId: TASK_ID,
        content: "Looks great",
      })
    );
  });

  it("non-client is blocked (403)", async () => {
    setupPmAuth();

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/review`,
      {
        method: "POST",
        body: { action: "approved" },
      }
    );
    const res = await POST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 on invalid body (missing action)", async () => {
    setupClientAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/review`,
      {
        method: "POST",
        body: { comment: "No action provided" },
      }
    );
    const res = await POST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 404 when task is not pending review", async () => {
    setupClientAuth();
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true as never);
    vi.mocked(getPhaseTaskPendingReview).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/review`,
      {
        method: "POST",
        body: { action: "approved" },
      }
    );
    const res = await POST_REVIEW(
      req,
      buildParams({ id: PROJECT_ID, taskId: TASK_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({
      error: "Task not found or not pending review",
    });
  });
});
