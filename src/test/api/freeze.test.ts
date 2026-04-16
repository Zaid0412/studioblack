import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH as freezePATCH } from "@/app/api/projects/[id]/attachments/[attachmentId]/freeze/route";
import { PATCH as unfreezePATCH } from "@/app/api/projects/[id]/attachments/[attachmentId]/unfreeze/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const { setAttachmentFreezeStatus, getOrgRole } = await import("@/lib/queries");

const PARAMS = buildParams({ id: "proj-1", attachmentId: "att-1" });

// ── Freeze ──────────────────────────────────────────────────────────────────

describe("PATCH /api/projects/[id]/attachments/[attachmentId]/freeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1/attachments/att-1/freeze", {
      method: "PATCH",
    });
    const res = await freezePATCH(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when attachment not found", async () => {
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValueOnce({
      error: "not_found",
      data: null,
    });

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/freeze", {
      method: "PATCH",
    });
    const res = await freezePATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 400 when already frozen", async () => {
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValueOnce({
      error: "already_frozen",
      data: null,
    });

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/freeze", {
      method: "PATCH",
    });
    const res = await freezePATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Already frozen" });
  });

  it("freezes attachment successfully", async () => {
    const data = { id: "att-1", frozen: true };
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValueOnce({
      error: null,
      data,
    });

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/freeze", {
      method: "PATCH",
    });
    const res = await freezePATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "att-1", frozen: true });
    expect(setAttachmentFreezeStatus).toHaveBeenCalledWith(
      "att-1",
      "proj-1",
      true
    );
  });
});

// ── Unfreeze ────────────────────────────────────────────────────────────────

describe("PATCH /api/projects/[id]/attachments/[attachmentId]/unfreeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 400 when already unfrozen", async () => {
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValueOnce({
      error: "already_unfrozen",
      data: null,
    });

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/unfreeze",
      { method: "PATCH" }
    );
    const res = await unfreezePATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Already unfrozen" });
  });

  it("unfreezes attachment successfully", async () => {
    const data = { id: "att-1", frozen: false };
    vi.mocked(setAttachmentFreezeStatus).mockResolvedValueOnce({
      error: null,
      data,
    });

    const req = buildRequest(
      "/api/projects/proj-1/attachments/att-1/unfreeze",
      { method: "PATCH" }
    );
    const res = await unfreezePATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "att-1", frozen: false });
    expect(setAttachmentFreezeStatus).toHaveBeenCalledWith(
      "att-1",
      "proj-1",
      false
    );
  });
});
