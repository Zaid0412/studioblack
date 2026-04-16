import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/projects/[id]/attachments/[attachmentId]/send-to-client/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const {
  getAttachmentById,
  markAttachmentSentToClient,
  getProjectClientInfo,
  getOrgRole,
} = await import("@/lib/queries");

const { createNotificationForClient } = await import("@/lib/notifications");
const { sendNotificationEmail } = await import("@/lib/email");

const PARAMS = buildParams({ id: "proj-1", attachmentId: "att-1" });

const unsentAttachment = {
  id: "att-1",
  file_name: "plan.pdf",
  sent_to_client_at: null,
};

describe("POST /api/projects/[id]/attachments/[attachmentId]/send-to-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when attachment not found", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce(null);

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 409 when already sent to client", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce({
      ...unsentAttachment,
      sent_to_client_at: new Date().toISOString(),
    });

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(409);
    expect(body).toMatchObject({ error: "Already sent to client" });
  });

  it("returns 409 when markAttachmentSentToClient returns null", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce(unsentAttachment);
    vi.mocked(markAttachmentSentToClient).mockResolvedValueOnce(null);
    vi.mocked(getProjectClientInfo).mockResolvedValueOnce(null);

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(409);
  });

  it("sends to client successfully", async () => {
    const updated = {
      ...unsentAttachment,
      sent_to_client_at: new Date().toISOString(),
    };

    vi.mocked(getAttachmentById).mockResolvedValueOnce(unsentAttachment);
    vi.mocked(markAttachmentSentToClient).mockResolvedValueOnce(updated);
    vi.mocked(getProjectClientInfo).mockResolvedValueOnce({
      client_email: "client@test.com",
      project_name: "Test Project",
    });

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.id).toBe("att-1");
    expect(markAttachmentSentToClient).toHaveBeenCalledWith(
      "att-1",
      "user-test-001"
    );
    expect(createNotificationForClient).toHaveBeenCalled();
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      "client@test.com",
      expect.stringContaining("Design Ready for Review"),
      expect.any(String)
    );
  });

  it("skips email when no client email", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce(unsentAttachment);
    vi.mocked(markAttachmentSentToClient).mockResolvedValueOnce({
      ...unsentAttachment,
      sent_to_client_at: new Date().toISOString(),
    });
    vi.mocked(getProjectClientInfo).mockResolvedValueOnce(null);

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/send-to-client",
      { method: "POST" }
    );
    const res = await POST(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});
