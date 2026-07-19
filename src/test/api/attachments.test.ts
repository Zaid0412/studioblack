import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAttachments,
  getAttachmentById,
  createProjectAttachment,
  updateAttachmentStatus,
  deleteAttachment,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/projects/[id]/attachments/route";
import {
  GET as GET_BY_ID,
  PATCH,
  DELETE,
} from "@/app/api/projects/[id]/attachments/[attachmentId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const ATTACHMENT_ID = "att-1";
const SUPABASE_FILE_URL =
  "https://test.supabase.co/storage/v1/object/public/files/test.pdf";

const sampleAttachment = {
  id: ATTACHMENT_ID,
  project_id: PROJECT_ID,
  phase_id: "phase-1",
  task_id: null,
  uploaded_by: TEST_USER_ID,
  file_url: SUPABASE_FILE_URL,
  file_name: "test.pdf",
  description: "",
  review_status: "pending",
  version_group: null,
  version_number: 1,
  frozen_at: null,
  created_at: "2024-01-01T00:00:00Z",
};

const validCreateBody = {
  fileUrl: SUPABASE_FILE_URL,
  fileName: "test.pdf",
  phaseId: "d1111111-1111-4111-8111-111111111111",
  // A new design upload must be classified (Document Control, PR-2).
  disciplineId: "e2222222-2222-4222-8222-222222222222",
  drawingType: "PLAN",
};

// ── GET /api/projects/[id]/attachments ──────────────────────────────────────

describe("GET /api/projects/[id]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns attachments list", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachments).mockResolvedValue([sampleAttachment] as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleAttachment]);
    expect(getAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID })
    );
  });

  it("filters by phaseId when provided", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachments).mockResolvedValue([sampleAttachment] as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`, {
      searchParams: { phaseId: "phase-1" },
    });
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(getAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, phaseId: "phase-1" })
    );
  });
});

// ── POST /api/projects/[id]/attachments ─────────────────────────────────────

describe("POST /api/projects/[id]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates attachment with valid body, returns 201", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(createProjectAttachment).mockResolvedValue(
      sampleAttachment as never
    );

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`, {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toMatchObject({ id: ATTACHMENT_ID });
    expect(createProjectAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        uploadedBy: TEST_USER_ID,
        fileName: "test.pdf",
        disciplineId: "e2222222-2222-4222-8222-222222222222",
        drawingType: "PLAN",
      })
    );
  });

  it("returns 400 when a new design upload has no discipline/type", async () => {
    setupAuth(mocks.auth, mockSession());

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`, {
      method: "POST",
      body: { fileUrl: SUPABASE_FILE_URL, fileName: "test.pdf" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));

    expect((await parseResponse(res)).status).toBe(400);
    expect(createProjectAttachment).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body (missing fileName)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`, {
      method: "POST",
      body: { fileUrl: SUPABASE_FILE_URL },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 if fileUrl doesn't point to Supabase", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments`, {
      method: "POST",
      body: {
        fileUrl: "https://evil.com/malware.exe",
        fileName: "malware.exe",
      },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: "fileUrl must point to the Supabase storage domain",
    });
  });
});

// ── GET /api/projects/[id]/attachments/[attachmentId] ───────────────────────

describe("GET /api/projects/[id]/attachments/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns attachment when found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`
    );
    const res = await GET_BY_ID(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: ATTACHMENT_ID, file_name: "test.pdf" });
    expect(getAttachmentById).toHaveBeenCalledWith(ATTACHMENT_ID, PROJECT_ID);
  });

  it("returns 404 when not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/attachments/att-999`);
    const res = await GET_BY_ID(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: "att-999" })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });
});

// ── PATCH /api/projects/[id]/attachments/[attachmentId] ─────────────────────

describe("PATCH /api/projects/[id]/attachments/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates review status", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    const updated = { ...sampleAttachment, review_status: "approved" };
    vi.mocked(updateAttachmentStatus).mockResolvedValue(updated as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "PATCH", body: { reviewStatus: "approved" } }
    );
    const res = await PATCH(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ review_status: "approved" });
    expect(updateAttachmentStatus).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID,
      "approved"
    );
  });

  it("client is blocked (403)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "PATCH", body: { reviewStatus: "approved" } }
    );
    const res = await PATCH(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/projects/[id]/attachments/[attachmentId] ────────────────────

describe("DELETE /api/projects/[id]/attachments/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PM can delete", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(deleteAttachment).mockResolvedValue(undefined as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(deleteAttachment).toHaveBeenCalledWith(ATTACHMENT_ID, PROJECT_ID);
  });

  it("client is blocked (403)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
