import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAttachmentById,
  getAttachmentVersionHistory,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { GET as GET_ATTACHMENT_VERSIONS } from "@/app/api/projects/[id]/attachments/[attachmentId]/versions/route";
import { GET as GET_BY_VERSION_GROUP } from "@/app/api/projects/[id]/versions/[versionGroup]/route";
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
const VERSION_GROUP = "vg-uuid-001";

const sampleAttachment = {
  id: ATTACHMENT_ID,
  project_id: PROJECT_ID,
  version_group: VERSION_GROUP,
  version_number: 1,
  file_url: "https://test.supabase.co/storage/v1/object/public/files/v1.pdf",
  file_name: "v1.pdf",
  uploaded_by: TEST_USER_ID,
  review_status: "pending",
  created_at: "2024-01-01T00:00:00Z",
};

const sampleVersions = [
  { ...sampleAttachment, version_number: 1 },
  {
    ...sampleAttachment,
    id: "att-2",
    version_number: 2,
    file_name: "v2.pdf",
    created_at: "2024-02-01T00:00:00Z",
  },
];

// ── GET /api/projects/[id]/attachments/[attachmentId]/versions ───────────────

describe("GET /api/projects/[id]/attachments/[attachmentId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/versions`
    );
    const res = await GET_ATTACHMENT_VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when attachment not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/versions`
    );
    const res = await GET_ATTACHMENT_VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 404 when attachment has no version_group", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue({
      ...sampleAttachment,
      version_group: null,
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/versions`
    );
    const res = await GET_ATTACHMENT_VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns version history for valid attachment", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(getAttachmentVersionHistory).mockResolvedValue(
      sampleVersions as never
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/versions`
    );
    const res = await GET_ATTACHMENT_VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(sampleVersions);
    expect(getAttachmentVersionHistory).toHaveBeenCalledWith(
      VERSION_GROUP,
      PROJECT_ID
    );
  });
});

// ── GET /api/projects/[id]/versions/[versionGroup] ──────────────────────────

describe("GET /api/projects/[id]/versions/[versionGroup]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/versions/${VERSION_GROUP}`
    );
    const res = await GET_BY_VERSION_GROUP(
      req,
      buildParams({ id: PROJECT_ID, versionGroup: VERSION_GROUP })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when no versions found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentVersionHistory).mockResolvedValue([] as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/versions/${VERSION_GROUP}`
    );
    const res = await GET_BY_VERSION_GROUP(
      req,
      buildParams({ id: PROJECT_ID, versionGroup: VERSION_GROUP })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns versions for valid version group", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentVersionHistory).mockResolvedValue(
      sampleVersions as never
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/versions/${VERSION_GROUP}`
    );
    const res = await GET_BY_VERSION_GROUP(
      req,
      buildParams({ id: PROJECT_ID, versionGroup: VERSION_GROUP })
    );
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(sampleVersions);
  });

  it("passes clientOnly flag when user role is client", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    // client role: getOrgRole returns null, hasProjectAccess true (matched via client_email)
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);
    vi.mocked(getAttachmentVersionHistory).mockResolvedValue(
      sampleVersions as never
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/versions/${VERSION_GROUP}`
    );
    const res = await GET_BY_VERSION_GROUP(
      req,
      buildParams({ id: PROJECT_ID, versionGroup: VERSION_GROUP })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(getAttachmentVersionHistory).toHaveBeenCalledWith(
      VERSION_GROUP,
      PROJECT_ID,
      true // clientOnly = true
    );
  });
});
