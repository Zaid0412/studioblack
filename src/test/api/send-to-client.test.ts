import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProjectForSendToClient,
  getUserByEmail,
  createClientUser,
  getOrgRole,
} from "@/lib/queries";
import { POST } from "@/app/api/projects/[id]/send-to-client/route";
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

const sampleProject = {
  id: PROJECT_ID,
  name: "Test Project",
  client_email: "client@example.com",
  client_name: "Test Client",
};

// ── POST /api/projects/[id]/send-to-client ──────────────────────────────────

describe("POST /api/projects/[id]/send-to-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for non-PM role (architect)", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("member");

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Project not found" });
  });

  it("returns 400 when project has no client email", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue({
      ...sampleProject,
      client_email: null,
    } as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No client email set on this project" });
  });

  it("creates client user and sends magic link for new client", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue(
      sampleProject as never
    );
    vi.mocked(getUserByEmail).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      email: "client@example.com",
    });
    expect(createClientUser).toHaveBeenCalledWith(
      "Test Client",
      "client@example.com"
    );
    expect(mocks.auth.signInMagicLink).toHaveBeenCalled();
  });

  it("skips user creation when client already exists", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue(
      sampleProject as never
    );
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-client",
      email: "client@example.com",
    } as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(createClientUser).not.toHaveBeenCalled();
    expect(mocks.auth.signInMagicLink).toHaveBeenCalled();
  });

  it("returns 500 when magic link fails", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue(
      sampleProject as never
    );
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-client",
    } as never);
    mocks.auth.signInMagicLink.mockRejectedValue(new Error("SMTP error"));

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Failed to send magic link email" });
  });

  it("uses email prefix as client name when client_name is null", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectForSendToClient).mockResolvedValue({
      ...sampleProject,
      client_name: null,
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null as never);
    mocks.auth.signInMagicLink.mockResolvedValue(undefined);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/send-to-client`, {
      method: "POST",
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(createClientUser).toHaveBeenCalledWith(
      "client",
      "client@example.com"
    );
  });
});
