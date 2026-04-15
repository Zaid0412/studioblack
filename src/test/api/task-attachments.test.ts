import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTaskAttachments,
  getTaskProjectId,
  createTaskAttachment,
  verifyTaskAccess,
  getTaskOrgId,
  getStandaloneTaskAttachment,
  getMemberRole,
  deleteAttachmentById,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import { GET, POST } from "@/app/api/tasks/[id]/attachments/route";
import { DELETE } from "@/app/api/tasks/[id]/attachments/[attachmentId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import "../setup";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const TASK_ID = "task-att-001";
const ATTACHMENT_ID = "att-001";
const PROJECT_ID = "project-test-001";

const fakeAttachment = {
  id: ATTACHMENT_ID,
  task_id: TASK_ID,
  project_id: PROJECT_ID,
  uploaded_by: TEST_USER_ID,
  file_url: "https://test.supabase.co/storage/v1/object/public/test/file.png",
  file_name: "file.png",
  file_size: 1024,
  created_at: "2024-01-01T00:00:00Z",
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
  vi.mocked(verifyTaskAccess).mockResolvedValue(true);
  vi.mocked(getTaskProjectId).mockResolvedValue(PROJECT_ID);
  vi.mocked(getTaskOrgId).mockResolvedValue(TEST_ORG_ID);
  vi.mocked(getMemberRole).mockResolvedValue("owner");
});

// ── GET /api/tasks/[id]/attachments ─────────────────────────────────────────

describe("GET /api/tasks/[id]/attachments", () => {
  it("returns attachments", async () => {
    vi.mocked(getTaskAttachments).mockResolvedValue([fakeAttachment]);

    const req = buildRequest(`/api/tasks/${TASK_ID}/attachments`);
    const res = await GET(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<typeof fakeAttachment[]>(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns 403 for client role", async () => {
    authAsClient();

    const req = buildRequest(`/api/tasks/${TASK_ID}/attachments`);
    const res = await GET(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/tasks/[id]/attachments ────────────────────────────────────────

describe("POST /api/tasks/[id]/attachments", () => {
  it("creates an attachment", async () => {
    const created = { ...fakeAttachment, id: "att-new-001" };
    vi.mocked(createTaskAttachment).mockResolvedValue(created);

    const req = buildRequest(`/api/tasks/${TASK_ID}/attachments`, {
      method: "POST",
      body: {
        fileUrl: "https://test.supabase.co/storage/v1/object/public/test/new.png",
        fileName: "new.png",
        fileSize: 2048,
      },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status, body } = await parseResponse<{ id: string }>(res);

    expect(status).toBe(201);
    expect(body.id).toBe("att-new-001");
    expect(createTaskAttachment).toHaveBeenCalledOnce();
  });

  it("returns 403 for client role", async () => {
    authAsClient();

    const req = buildRequest(`/api/tasks/${TASK_ID}/attachments`, {
      method: "POST",
      body: {
        fileUrl: "https://test.supabase.co/storage/v1/object/public/test/new.png",
        fileName: "new.png",
      },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 on invalid body", async () => {
    const req = buildRequest(`/api/tasks/${TASK_ID}/attachments`, {
      method: "POST",
      body: { fileUrl: "not-a-url", fileName: "" },
    });
    const res = await POST(req, buildParams({ id: TASK_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

// ── DELETE /api/tasks/[id]/attachments/[attachmentId] ───────────────────────

describe("DELETE /api/tasks/[id]/attachments/[attachmentId]", () => {
  it("deletes attachment as uploader", async () => {
    vi.mocked(getStandaloneTaskAttachment).mockResolvedValue(fakeAttachment);
    vi.mocked(deleteAttachmentById).mockResolvedValue(undefined);

    const req = buildRequest(
      `/api/tasks/${TASK_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE(
      req,
      buildParams({ id: TASK_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteAttachmentById).toHaveBeenCalledWith(ATTACHMENT_ID);
  });

  it("returns 403 for client role", async () => {
    authAsClient();

    const req = buildRequest(
      `/api/tasks/${TASK_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE(
      req,
      buildParams({ id: TASK_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
