import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAttachmentById,
  submitAttachmentReview,
  createAttachmentReview,
  setAttachmentFreezeStatus,
  markAttachmentSentToClient,
  getProjectClientInfo,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { PATCH as REVIEW } from "@/app/api/projects/[id]/attachments/[attachmentId]/review/route";
import { PATCH as FREEZE } from "@/app/api/projects/[id]/attachments/[attachmentId]/freeze/route";
import { PATCH as UNFREEZE } from "@/app/api/projects/[id]/attachments/[attachmentId]/unfreeze/route";
import { POST as SEND_TO_CLIENT } from "@/app/api/projects/[id]/attachments/[attachmentId]/send-to-client/route";
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
const ATTACHMENT_ID = "att-1";

const routeParams = buildParams({
  id: PROJECT_ID,
  attachmentId: ATTACHMENT_ID,
});

const sampleAttachment = {
  id: ATTACHMENT_ID,
  project_id: PROJECT_ID,
  file_name: "floor-plan.pdf",
  review_status: "pending",
  frozen_at: null,
  sent_to_client_at: null,
};

// ── PATCH /api/projects/[id]/attachments/[attachmentId]/review ──────────────

describe("PATCH .../review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves attachment", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    const updatedAttachment = {
      ...sampleAttachment,
      review_status: "approved",
    };
    vi.mocked(submitAttachmentReview).mockResolvedValue({
      attachment: updatedAttachment,
      conflict: false,
    } as never);
    vi.mocked(createAttachmentReview).mockResolvedValue(undefined as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/review`,
      { method: "PATCH", body: { status: "approved" } }
    );
    const res = await REVIEW(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updatedAttachment);
    expect(submitAttachmentReview).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID,
      session.user.id,
      "approved",
      undefined
    );
  });

  it("rejects attachment with comment", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    const updatedAttachment = {
      ...sampleAttachment,
      review_status: "rejected",
    };
    vi.mocked(submitAttachmentReview).mockResolvedValue({
      attachment: updatedAttachment,
      conflict: false,
    } as never);
    vi.mocked(createAttachmentReview).mockResolvedValue(undefined as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/review`,
      {
        method: "PATCH",
        body: { status: "rejected", comment: "Needs more detail" },
      }
    );
    const res = await REVIEW(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updatedAttachment);
    expect(submitAttachmentReview).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID,
      session.user.id,
      "rejected",
      "Needs more detail"
    );
  });

  it("returns 400 on invalid body", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/review`,
      { method: "PATCH", body: { status: "invalid-status" } }
    );
    const res = await REVIEW(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

// ── PATCH .../freeze ────────────────────────────────────────────────────────

describe("PATCH .../freeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PM can freeze", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("owner" as never);

    const frozenAttachment = {
      ...sampleAttachment,
      frozen_at: new Date().toISOString(),
    };
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValue({
      error: null,
      data: frozenAttachment,
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/freeze`,
      { method: "PATCH" }
    );
    const res = await FREEZE(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(frozenAttachment);
    expect(setAttachmentFreezeStatus).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID,
      true
    );
  });

  it("non-PM gets 403", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("member" as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/freeze`,
      { method: "PATCH" }
    );
    const res = await FREEZE(req, routeParams);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH .../unfreeze ──────────────────────────────────────────────────────

describe("PATCH .../unfreeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PM can unfreeze", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("owner" as never);

    const unfrozenAttachment = { ...sampleAttachment, frozen_at: null };
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValue({
      error: null,
      data: unfrozenAttachment,
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/unfreeze`,
      { method: "PATCH" }
    );
    const res = await UNFREEZE(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(unfrozenAttachment);
    expect(setAttachmentFreezeStatus).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      PROJECT_ID,
      false
    );
  });

  it("non-PM gets 403", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("member" as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/unfreeze`,
      { method: "PATCH" }
    );
    const res = await UNFREEZE(req, routeParams);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST .../send-to-client ─────────────────────────────────────────────────

describe("POST .../send-to-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("staff can send to client", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("owner" as never);

    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    const sentAttachment = {
      ...sampleAttachment,
      sent_to_client_at: new Date().toISOString(),
    };
    vi.mocked(markAttachmentSentToClient).mockResolvedValue(
      sentAttachment as never
    );
    vi.mocked(getProjectClientInfo).mockResolvedValue({
      client_email: "client@test.com",
      project_name: "Test Project",
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/send-to-client`,
      { method: "POST" }
    );
    const res = await SEND_TO_CLIENT(req, routeParams);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(sentAttachment);
    expect(markAttachmentSentToClient).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      session.user.id
    );
  });

  it("client is blocked (403)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/send-to-client`,
      { method: "POST" }
    );
    const res = await SEND_TO_CLIENT(req, routeParams);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
