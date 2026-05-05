import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTaskById,
  listTaskComments,
  createTaskComment,
  getTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import {
  GET as LIST,
  POST as CREATE,
} from "@/app/api/tasks/[id]/comments/route";
import {
  PATCH as EDIT,
  DELETE as REMOVE,
} from "@/app/api/tasks/[id]/comments/[commentId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import type { TaskComment } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const TASK_ID = "task-test-001";
const COMMENT_ID = "comment-test-001";
const OTHER_USER_ID = "user-test-other";

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

const fakeComment: TaskComment = {
  id: COMMENT_ID,
  org_id: TEST_ORG_ID,
  task_id: TASK_ID,
  author_id: TEST_USER_ID,
  body: "Hello world",
  attachments: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  author_name: "Test User",
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

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
});

// ── GET /api/tasks/[id]/comments ────────────────────────────────────────────

describe("GET /api/tasks/[id]/comments", () => {
  it("returns the comment list", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(listTaskComments).mockResolvedValue([fakeComment]);

    const res = await LIST(
      buildRequest(`/api/tasks/${TASK_ID}/comments`),
      buildParams({ id: TASK_ID })
    );
    const { status, body } = await parseResponse<{ comments: TaskComment[] }>(
      res
    );
    expect(status).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].body).toBe("Hello world");
  });

  it("returns 404 when task missing", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);
    const res = await LIST(
      buildRequest(`/api/tasks/${TASK_ID}/comments`),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(404);
  });

  it("rejects client role", async () => {
    authAsClient();
    const res = await LIST(
      buildRequest(`/api/tasks/${TASK_ID}/comments`),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── POST /api/tasks/[id]/comments ───────────────────────────────────────────

describe("POST /api/tasks/[id]/comments", () => {
  it("creates a comment", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(createTaskComment).mockResolvedValue(fakeComment);

    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: { body: "Hello world" },
      }),
      buildParams({ id: TASK_ID })
    );
    const { status, body } = await parseResponse<TaskComment>(res);
    expect(status).toBe(201);
    expect(body.id).toBe(COMMENT_ID);
    expect(createTaskComment).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: TEST_ORG_ID,
        taskId: TASK_ID,
        authorId: TEST_USER_ID,
        body: "Hello world",
      })
    );
  });

  it("creates a comment with inline attachments", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    const withAttachments: TaskComment = {
      ...fakeComment,
      attachments: [
        {
          url: "https://example.com/file.png",
          name: "file.png",
          contentType: "image/png",
          size: 12345,
        },
      ],
    };
    vi.mocked(createTaskComment).mockResolvedValue(withAttachments);

    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: {
          body: "See file",
          attachments: [
            {
              url: "https://example.com/file.png",
              name: "file.png",
              contentType: "image/png",
              size: 12345,
            },
          ],
        },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(201);
    expect(createTaskComment).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ name: "file.png" }),
        ]),
      })
    );
  });

  it("returns 400 when body is empty", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: { body: "  " },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when task missing", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: { body: "Hi" },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(404);
  });

  it("rejects client role", async () => {
    authAsClient();
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: { body: "Hi" },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/tasks/[id]/comments/[commentId] ──────────────────────────────

describe("PATCH /api/tasks/[id]/comments/[commentId]", () => {
  it("edits the author's own comment", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue(fakeComment);
    vi.mocked(updateTaskComment).mockResolvedValue({
      ...fakeComment,
      body: "Edited",
      updated_at: "2024-01-02T00:00:00Z",
    });

    const res = await EDIT(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "PATCH",
        body: { body: "Edited" },
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    const { status, body } = await parseResponse<TaskComment>(res);
    expect(status).toBe(200);
    expect(body.body).toBe("Edited");
  });

  it("rejects edits from a different user", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue({
      ...fakeComment,
      author_id: OTHER_USER_ID,
    });

    const res = await EDIT(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "PATCH",
        body: { body: "Hijack" },
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when comment doesn't belong to task", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue({
      ...fakeComment,
      task_id: "task-other-001",
    });
    const res = await EDIT(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "PATCH",
        body: { body: "Edit" },
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/tasks/[id]/comments/[commentId] ─────────────────────────────

describe("DELETE /api/tasks/[id]/comments/[commentId]", () => {
  it("deletes the author's own comment", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue(fakeComment);
    vi.mocked(deleteTaskComment).mockResolvedValue(true);

    const res = await REMOVE(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(200);
  });

  it("rejects deletion from a different user", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue({
      ...fakeComment,
      author_id: OTHER_USER_ID,
    });
    const res = await REMOVE(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when comment missing", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskComment).mockResolvedValue(null);
    const res = await REMOVE(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(404);
  });
});
