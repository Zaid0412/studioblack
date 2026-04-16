import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as requestReviewPOST } from "@/app/api/projects/[id]/tasks/[taskId]/request-review/route";
import { POST as reviewPOST } from "@/app/api/projects/[id]/tasks/[taskId]/review/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const {
  markPhaseTaskForReview,
  getProjectReviewInfo,
  verifyTaskOwnership,
  getPhaseTaskPendingReview,
  updatePhaseTaskReviewStatus,
  getOrgRole,
} = await import("@/lib/queries");

const PARAMS = buildParams({ id: "proj-1", taskId: "task-1" });

// ── Request Review ──────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/tasks/[taskId]/request-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true);
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest(
      "/api/projects/proj-1/tasks/task-1/request-review",
      { method: "POST" }
    );
    const res = await requestReviewPOST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when task not owned by project", async () => {
    vi.mocked(verifyTaskOwnership).mockResolvedValue(false);

    const req = buildRequest(
      "/api/projects/proj-1/tasks/task-1/request-review",
      { method: "POST" }
    );
    const res = await requestReviewPOST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when task not found", async () => {
    vi.mocked(markPhaseTaskForReview).mockResolvedValueOnce(null);

    const req = buildRequest(
      "/api/projects/proj-1/tasks/task-1/request-review",
      { method: "POST" }
    );
    const res = await requestReviewPOST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("marks task for review and returns it", async () => {
    const task = {
      id: "task-1",
      title: "Design Layout",
      status: "pending_review",
    };
    vi.mocked(markPhaseTaskForReview).mockResolvedValueOnce(task);
    vi.mocked(getProjectReviewInfo).mockResolvedValueOnce({
      name: "Proj",
      client_email: "client@test.com",
    });

    const req = buildRequest(
      "/api/projects/proj-1/tasks/task-1/request-review",
      { method: "POST" }
    );
    const res = await requestReviewPOST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "task-1", title: "Design Layout" });
  });
});

// ── Review (client approves/rejects) ────────────────────────────────────────

describe("POST /api/projects/[id]/tasks/[taskId]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    vi.mocked(verifyTaskOwnership).mockResolvedValue(true);
    vi.mocked(getOrgRole).mockResolvedValue("client");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1/tasks/task-1/review", {
      method: "POST",
      body: { action: "approved" },
    });
    const res = await reviewPOST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const req = buildRequest("/api/projects/proj-1/tasks/task-1/review", {
      method: "POST",
      body: { action: "invalid-action" },
    });
    const res = await reviewPOST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when task not pending review", async () => {
    vi.mocked(getPhaseTaskPendingReview).mockResolvedValueOnce(null);

    const req = buildRequest("/api/projects/proj-1/tasks/task-1/review", {
      method: "POST",
      body: { action: "approved" },
    });
    const res = await reviewPOST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body.error).toContain("not pending review");
  });

  it("approves a task successfully", async () => {
    vi.mocked(getPhaseTaskPendingReview).mockResolvedValueOnce({
      id: "task-1",
      phase_id: "phase-1",
      assigned_to: "arch-1",
    });
    const updated = { id: "task-1", title: "Layout", status: "approved" };
    vi.mocked(updatePhaseTaskReviewStatus).mockResolvedValueOnce(updated);

    const req = buildRequest("/api/projects/proj-1/tasks/task-1/review", {
      method: "POST",
      body: { action: "approved", comment: "Looks great!" },
    });
    const res = await reviewPOST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "task-1", status: "approved" });
    expect(updatePhaseTaskReviewStatus).toHaveBeenCalledWith(
      "task-1",
      "approved"
    );
  });

  it("requests changes on a task", async () => {
    vi.mocked(getPhaseTaskPendingReview).mockResolvedValueOnce({
      id: "task-1",
      phase_id: "phase-1",
      assigned_to: null,
    });
    const updated = {
      id: "task-1",
      title: "Layout",
      status: "changes_requested",
    };
    vi.mocked(updatePhaseTaskReviewStatus).mockResolvedValueOnce(updated);

    const req = buildRequest("/api/projects/proj-1/tasks/task-1/review", {
      method: "POST",
      body: { action: "changes_requested" },
    });
    const res = await reviewPOST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.status).toBe("changes_requested");
  });
});
