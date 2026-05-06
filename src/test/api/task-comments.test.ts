import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTaskComment,
  getTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import { POST as CREATE } from "@/app/api/tasks/[id]/comments/route";
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

// GET /api/tasks/[id]/comments was removed — comments now flow through
// the /activity endpoint (merged with audit events). Coverage for the
// activity endpoint lives in `task-activity.test.ts`.

// ── POST /api/tasks/[id]/comments ───────────────────────────────────────────

describe("POST /api/tasks/[id]/comments", () => {
  it("creates a comment", async () => {
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
    const storageUrl =
      "https://example.supabase.co/storage/v1/object/public/task-files/file.png";
    const withAttachments: TaskComment = {
      ...fakeComment,
      attachments: [
        {
          url: storageUrl,
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
              url: storageUrl,
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

  it("rejects javascript: scheme in attachment URLs (XSS guard)", async () => {
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: {
          body: "Click me",
          attachments: [
            {
              url: "javascript:alert(1)",
              name: "evil",
              contentType: "text/html",
              size: 1,
            },
          ],
        },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(400);
    expect(createTaskComment).not.toHaveBeenCalled();
  });

  it("rejects non-Supabase https URLs in attachments", async () => {
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: {
          body: "external",
          attachments: [
            {
              url: "https://evil.example.com/payload.html",
              name: "x",
              contentType: "text/html",
              size: 1,
            },
          ],
        },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(400);
    expect(createTaskComment).not.toHaveBeenCalled();
  });

  it("returns 400 when body is empty", async () => {
    const res = await CREATE(
      buildRequest(`/api/tasks/${TASK_ID}/comments`, {
        method: "POST",
        body: { body: "  " },
      }),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when task missing or out of org", async () => {
    // `createTaskComment` returns null when its CTE existence check fails
    // (task doesn't exist or belongs to another org).
    vi.mocked(createTaskComment).mockResolvedValue(null);
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
  it("edits the author's own comment (single SQL round trip)", async () => {
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
    // The org+task+author scoping is folded into the UPDATE itself.
    expect(updateTaskComment).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: TEST_ORG_ID,
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        authorId: TEST_USER_ID,
      })
    );
    // Disambiguation `getTaskComment` is only run on the failure path.
    expect(getTaskComment).not.toHaveBeenCalled();
  });

  it("returns 403 when caller isn't the author (one disambiguation lookup)", async () => {
    // The UPDATE returns null (filter excluded the row); the route then
    // does ONE follow-up `getTaskComment` to distinguish 404 from 403.
    vi.mocked(updateTaskComment).mockResolvedValue(null);
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
    expect(getTaskComment).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the comment belongs to a different task", async () => {
    vi.mocked(updateTaskComment).mockResolvedValue(null);
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

  it("returns 404 when the comment doesn't exist at all", async () => {
    vi.mocked(updateTaskComment).mockResolvedValue(null);
    vi.mocked(getTaskComment).mockResolvedValue(null);
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
  it("deletes the author's own comment (single SQL round trip)", async () => {
    vi.mocked(deleteTaskComment).mockResolvedValue(true);

    const res = await REMOVE(
      buildRequest(`/api/tasks/${TASK_ID}/comments/${COMMENT_ID}`, {
        method: "DELETE",
      }),
      buildParams({ id: TASK_ID, commentId: COMMENT_ID })
    );
    expect(res.status).toBe(200);
    expect(deleteTaskComment).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: TEST_ORG_ID,
        commentId: COMMENT_ID,
        taskId: TASK_ID,
        authorId: TEST_USER_ID,
      })
    );
    expect(getTaskComment).not.toHaveBeenCalled();
  });

  it("returns 403 when caller isn't the author", async () => {
    vi.mocked(deleteTaskComment).mockResolvedValue(false);
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
    vi.mocked(deleteTaskComment).mockResolvedValue(false);
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
