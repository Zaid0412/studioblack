import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/projects/[id]/attachments/[attachmentId]/issue/route";
import { GET as REVISIONS_GET } from "@/app/api/projects/[id]/attachments/[attachmentId]/revisions/route";
import {
  issueRevision,
  getRevisionsForAttachment,
  getOrgRole,
  getMemberRole,
} from "@/lib/queries";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";

vi.mock("@/lib/posthog-server", () => ({
  getServerFeatureFlag: vi.fn(),
}));

const PROJECT_ID = "proj-1";
const ATTACHMENT_ID = "att-1";
const PARAMS = buildParams({ id: PROJECT_ID, attachmentId: ATTACHMENT_ID });
const path = `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/issue`;

const sampleRevision = {
  id: "rev-1",
  drawing_id: "draw-1",
  org_id: "org-1",
  rev_number: 1,
  attachment_id: ATTACHMENT_ID,
  issue_purpose: "internal_review",
  issued_by: TEST_USER_ID,
  issued_at: "2026-07-20T00:00:00Z",
  created_at: "2026-07-20T00:00:00Z",
};

function issueRequest(body: unknown = { issuePurpose: "internal_review" }) {
  return buildRequest(path, { method: "POST", body });
}

describe("POST .../attachments/[attachmentId]/issue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(getServerFeatureFlag).mockResolvedValue(true);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const res = await POST(issueRequest(), PARAMS);
    expect((await parseResponse(res)).status).toBe(401);
  });

  it("returns 403 for a non-PM role (architect)", async () => {
    setupAuth(mocks.auth, mockSession({ role: "architect" }));
    vi.mocked(getMemberRole).mockResolvedValueOnce("member");
    const res = await POST(issueRequest(), PARAMS);
    expect((await parseResponse(res)).status).toBe(403);
  });

  it("returns 404 when the module flag is off (dormant)", async () => {
    vi.mocked(getServerFeatureFlag).mockResolvedValue(false);
    const res = await POST(issueRequest(), PARAMS);
    expect((await parseResponse(res)).status).toBe(404);
    expect(issueRevision).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid issue purpose", async () => {
    const res = await POST(issueRequest({ issuePurpose: "bogus" }), PARAMS);
    expect((await parseResponse(res)).status).toBe(400);
    expect(issueRevision).not.toHaveBeenCalled();
  });

  it("returns 400 when the file has no drawing to revise", async () => {
    vi.mocked(issueRevision).mockResolvedValue({
      revision: null,
      reason: "no_drawing",
    });
    const res = await POST(issueRequest(), PARAMS);
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("returns 404 when the attachment is not in this project", async () => {
    vi.mocked(issueRevision).mockResolvedValue({
      revision: null,
      reason: "not_found",
    });
    const res = await POST(issueRequest(), PARAMS);
    expect((await parseResponse(res)).status).toBe(404);
  });

  it("issues the next revision (201)", async () => {
    vi.mocked(issueRevision).mockResolvedValue({ revision: sampleRevision });
    const res = await POST(issueRequest(), PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(sampleRevision);
    expect(issueRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: ATTACHMENT_ID,
        projectId: PROJECT_ID,
        userId: TEST_USER_ID,
        issuePurpose: "internal_review",
      })
    );
  });
});

describe("GET .../attachments/[attachmentId]/revisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns the drawing's revision history", async () => {
    vi.mocked(getRevisionsForAttachment).mockResolvedValue([
      sampleRevision,
    ] as never);
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/revisions`
    );
    const res = await REVISIONS_GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ revisions: [sampleRevision] });
    expect(getRevisionsForAttachment).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID
    );
  });
});
