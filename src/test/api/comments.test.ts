import { describe, it, expect, vi, beforeEach } from "vitest";
import { getComments, createComment } from "@/lib/queries";
import { GET, POST } from "@/app/api/projects/[id]/comments/route";
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

const sampleComment = {
  id: "comment-1",
  project_id: PROJECT_ID,
  phase_id: null,
  task_id: null,
  user_id: "user-test-001",
  content: "Looks good",
  created_at: "2024-06-01T00:00:00.000Z",
};

// ── GET /api/projects/[id]/comments ─────────────────────────────────────────

describe("GET /api/projects/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/comments`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns comments list", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getComments).mockResolvedValue([sampleComment] as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/comments`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleComment]);
    expect(getComments).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      phaseId: undefined,
      taskId: undefined,
    });
  });
});

// ── POST /api/projects/[id]/comments ────────────────────────────────────────

describe("POST /api/projects/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates comment with valid body", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    const created = { ...sampleComment, content: "New comment" };
    vi.mocked(createComment).mockResolvedValue(created as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/comments`, {
      method: "POST",
      body: { content: "New comment" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(created);
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        userId: session.user.id,
        content: "New comment",
      })
    );
  });

  it("returns 400 on invalid body (empty content)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/comments`, {
      method: "POST",
      body: { content: "" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});
