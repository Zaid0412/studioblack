import { describe, it, expect, vi, beforeEach } from "vitest";
import * as attachments from "@/lib/api/attachments";
import * as tasks from "@/lib/api/tasks";
import * as notifications from "@/lib/api/notifications";
import * as projects from "@/lib/api/projects";
import * as comments from "@/lib/api/comments";
import * as approvals from "@/lib/api/approvals";
import * as pinComments from "@/lib/api/pinComments";
import * as upload from "@/lib/api/upload";

// ── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.clearAllMocks());

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── attachments ─────────────────────────────────────────────────────────────

describe("attachments", () => {
  describe("list", () => {
    it("calls bare URL with no options", async () => {
      mockFetch.mockResolvedValue(okJson([]));

      await attachments.list("proj-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/projects/proj-1/attachments",
        undefined
      );
    });

    it("appends phaseId query param", async () => {
      mockFetch.mockResolvedValue(okJson([]));

      await attachments.list("proj-1", { phaseId: "phase-1" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/projects/proj-1/attachments?phaseId=phase-1",
        undefined
      );
    });

    it("appends all=true query param", async () => {
      mockFetch.mockResolvedValue(okJson([]));

      await attachments.list("proj-1", { all: true });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/projects/proj-1/attachments?all=true",
        undefined
      );
    });

    it("appends both phaseId and all params", async () => {
      mockFetch.mockResolvedValue(okJson([]));

      await attachments.list("proj-1", { phaseId: "phase-1", all: true });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("phaseId=phase-1");
      expect(url).toContain("all=true");
    });
  });

  it("get — fetches a single attachment by ID", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "file-1" }));

    await attachments.get("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1",
      undefined
    );
  });

  it("create — posts attachment data to the project URL", async () => {
    const data = {
      fileUrl: "https://example.com/file.pdf",
      fileName: "file.pdf",
      description: "A file",
      phaseId: "phase-1",
    };
    mockFetch.mockResolvedValue(okJson({ id: "file-1" }));

    await attachments.create("proj-1", data);

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("getReviewHistory — fetches review history for an attachment", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.getReviewHistory("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/review",
      undefined
    );
  });

  it("submitReview — patches review data to the attachment review URL", async () => {
    const data = { status: "approved" as const, comment: "Looks good" };
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.submitReview("proj-1", "file-1", data);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/review",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  });

  it("getVersionHistory — fetches version history by version group", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.getVersionHistory("proj-1", "vg-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/versions/vg-1",
      undefined
    );
  });

  it("freeze — patches the freeze endpoint", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.freeze("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/freeze",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      }
    );
  });

  it("unfreeze — patches the unfreeze endpoint", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.unfreeze("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/unfreeze",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      }
    );
  });

  it("markReviewed — patches the attachment with reviewStatus", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.markReviewed("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: "reviewed" }),
      }
    );
  });

  it("sendToClient — posts to the send-to-client endpoint", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.sendToClient("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/send-to-client",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      }
    );
  });

  it("remove — sends DELETE to the attachment URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await attachments.remove("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1",
      { method: "DELETE" }
    );
  });
});

// ── tasks ───────────────────────────────────────────────────────────────────

describe("tasks", () => {
  describe("list", () => {
    it("calls bare URL with no params", async () => {
      mockFetch.mockResolvedValue(okJson({ tasks: [], counts: {}, total: 0 }));

      await tasks.list();

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks", undefined);
    });

    it("appends query string from params", async () => {
      mockFetch.mockResolvedValue(okJson({ tasks: [], counts: {}, total: 0 }));

      await tasks.list({ status: "todo", projectId: "proj-1" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=todo");
      expect(url).toContain("projectId=proj-1");
    });
  });

  it("get — fetches a single task by ID", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "task-1" }));

    await tasks.get("task-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1", undefined);
  });

  it("create — posts task data to the tasks URL", async () => {
    const data = { title: "New task", projectId: "proj-1", priority: "high" };
    mockFetch.mockResolvedValue(okJson({ id: "task-1" }));

    await tasks.create(data);

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("update — patches task data by ID", async () => {
    const data = { title: "Updated", status: "done" };
    mockFetch.mockResolvedValue(okJson({ id: "task-1" }));

    await tasks.update("task-1", data);

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("remove — sends DELETE to the task URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.remove("task-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1", {
      method: "DELETE",
    });
  });

  it("toggleStar — posts to the star endpoint", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.toggleStar("task-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
  });

  it("getChecklist — fetches checklist for a task", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await tasks.getChecklist("task-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/checklist",
      undefined
    );
  });

  it("addChecklistItem — posts a new checklist item", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "item-1" }));

    await tasks.addChecklistItem("task-1", "Buy paint");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Buy paint" }),
    });
  });

  it("toggleChecklistItem — patches checklist item done state", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.toggleChecklistItem("task-1", "item-1", true);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/checklist/item-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: true }),
      }
    );
  });

  it("removeChecklistItem — sends DELETE to checklist item URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.removeChecklistItem("task-1", "item-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/checklist/item-1",
      { method: "DELETE" }
    );
  });

  it("reorderChecklist — patches reorder endpoint with ordered IDs", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.reorderChecklist("task-1", ["a", "b", "c"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/checklist/reorder",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ["a", "b", "c"] }),
      }
    );
  });

  it("getAttachments — fetches attachments for a task", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await tasks.getAttachments("task-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/attachments",
      undefined
    );
  });

  it("addAttachment — posts attachment data to the task attachments URL", async () => {
    const data = {
      fileUrl: "https://example.com/file.pdf",
      fileName: "file.pdf",
      fileSize: 1024,
    };
    mockFetch.mockResolvedValue(okJson({ id: "att-1" }));

    await tasks.addAttachment("task-1", data);

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("removeAttachment — sends DELETE to task attachment URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.removeAttachment("task-1", "att-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/attachments/att-1",
      { method: "DELETE" }
    );
  });

  it("submitReview — posts review data to the project task review URL", async () => {
    const data = { action: "approve", comment: "LGTM" };
    mockFetch.mockResolvedValue(okJson({}));

    await tasks.submitReview("proj-1", "task-1", data);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/tasks/task-1/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  });

  it("getPendingReview — fetches pending review tasks for a project", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await tasks.getPendingReview("proj-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/tasks/pending-review",
      undefined
    );
  });
});

// ── notifications ───────────────────────────────────────────────────────────

describe("notifications", () => {
  it("list — fetches all notifications", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await notifications.list();

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", undefined);
  });

  it("markRead — patches with notification IDs", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await notifications.markRead(["n-1", "n-2"]);

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["n-1", "n-2"] }),
    });
  });

  it("markAllRead — patches with markAllRead flag", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await notifications.markAllRead();

    expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
  });
});

// ── projects ────────────────────────────────────────────────────────────────

describe("projects", () => {
  it("list — fetches all projects", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await projects.list();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects", undefined);
  });

  it("get — fetches a single project by ID", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "proj-1" }));

    await projects.get("proj-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1", undefined);
  });

  it("create — posts project data", async () => {
    const data = { name: "Project Alpha", clientName: "Client A" };
    mockFetch.mockResolvedValue(okJson({ id: "proj-1" }));

    await projects.create(data);

    expect(mockFetch).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("update — patches project data by ID", async () => {
    const data = { name: "Updated Name" };
    mockFetch.mockResolvedValue(okJson({ id: "proj-1" }));

    await projects.update("proj-1", data);

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });

  it("remove — sends DELETE to the project URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await projects.remove("proj-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1", {
      method: "DELETE",
    });
  });
});

// ── comments ────────────────────────────────────────────────────────────────

describe("comments", () => {
  it("list — fetches all comments for a project", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await comments.list("proj-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/comments",
      undefined
    );
  });

  it("create — posts a comment to the project", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await comments.create("proj-1", "Hello world");

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello world" }),
    });
  });
});

// ── approvals ───────────────────────────────────────────────────────────────

describe("approvals", () => {
  it("list — fetches all approvals for a project", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await approvals.list("proj-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/approvals",
      undefined
    );
  });

  it("submit — posts an approval decision", async () => {
    const data = { decision: "approved" as const, comment: "All good" };
    mockFetch.mockResolvedValue(okJson({ id: "appr-1" }));

    await approvals.submit("proj-1", data);

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/proj-1/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  });
});

// ── pinComments ─────────────────────────────────────────────────────────────

describe("pinComments", () => {
  it("list — fetches pin comments for an attachment", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await pinComments.list("proj-1", "file-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins",
      undefined
    );
  });

  it("listReplies — fetches replies for a specific pin", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await pinComments.listReplies("proj-1", "file-1", "pin-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins/pin-1/replies",
      undefined
    );
  });

  it("create — posts a new pin comment", async () => {
    const data = {
      x_percent: 50,
      y_percent: 25,
      page: 1,
      content: "Fix this",
    };
    mockFetch.mockResolvedValue(okJson({ id: "pin-1" }));

    await pinComments.create("proj-1", "file-1", data);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  });

  it("resolve — patches the pin with resolved status", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "pin-1" }));

    await pinComments.resolve("proj-1", "file-1", "pin-1", true);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins/pin-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      }
    );
  });

  it("editContent — patches the pin with new content", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "pin-1" }));

    await pinComments.editContent("proj-1", "file-1", "pin-1", "Updated text");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins/pin-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated text" }),
      }
    );
  });

  it("reposition — patches the pin with new coordinates", async () => {
    const coords = { x_percent: 30, y_percent: 60, page: 2 };
    mockFetch.mockResolvedValue(okJson({ id: "pin-1" }));

    await pinComments.reposition("proj-1", "file-1", "pin-1", coords);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins/pin-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords),
      }
    );
  });

  it("remove — sends DELETE to the pin URL", async () => {
    mockFetch.mockResolvedValue(okJson({}));

    await pinComments.remove("proj-1", "file-1", "pin-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments/file-1/pins/pin-1",
      { method: "DELETE" }
    );
  });
});

// ── upload ──────────────────────────────────────────────────────────────────

describe("upload", () => {
  it("uploadFile — requests a signed URL, then PUTs the file directly", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          signedUrl: "https://storage.supabase.co/upload?token=abc",
          publicUrl: "https://example.com/file.pdf",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const file = new File(["content"], "file.pdf", {
      type: "application/pdf",
    });
    const result = await upload.uploadFile(file);

    expect(result).toEqual({
      url: "https://example.com/file.pdf",
      fileName: "file.pdf",
    });
    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/upload/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "file.pdf", fileSize: file.size }),
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://storage.supabase.co/upload?token=abc",
      {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "application/pdf",
        },
      }
    );
  });

  it("uploadFile — throws ApiError when the Supabase PUT fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          signedUrl: "https://storage.supabase.co/upload?token=abc",
          publicUrl: "https://example.com/file.pdf",
        })
      )
      .mockResolvedValueOnce(new Response("cors blocked", { status: 403 }));

    const { ApiError } = await import("@/lib/api/client");
    const file = new File(["content"], "file.pdf", {
      type: "application/pdf",
    });

    let thrown: unknown;
    try {
      await upload.uploadFile(file);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as InstanceType<typeof ApiError>).status).toBe(403);
  });

  it("uploadAvatar — posts FormData to the avatar URL", async () => {
    mockFetch.mockResolvedValue(okJson({ url: "https://example.com/av.jpg" }));

    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    await upload.uploadAvatar(file);

    expect(mockFetch).toHaveBeenCalledWith("/api/avatar", {
      method: "POST",
      body: expect.any(FormData),
    });
  });

  it("downloadFile — fetches the proxy-file URL and returns a blob", async () => {
    mockFetch.mockResolvedValue(new Response(new Blob(["data"])));

    const blob = await upload.downloadFile("https://example.com/file.pdf");

    expect(blob).toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/proxy-file?url=${encodeURIComponent("https://example.com/file.pdf")}`
    );
  });
});
