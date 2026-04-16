import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/projects/[id]/attachments/[attachmentId]/versions/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const { getAttachmentById, getAttachmentVersionHistory } =
  await import("@/lib/queries");

const PARAMS = buildParams({ id: "proj-1", attachmentId: "att-1" });

describe("GET /api/projects/[id]/attachments/[attachmentId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1/attachments/att-1/versions");
    const res = await GET(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when attachment not found", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce(null);

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/versions");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 404 when attachment has no version_group", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce({
      id: "att-1",
      version_group: null,
    });

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/versions");
    const res = await GET(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns version history", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce({
      id: "att-1",
      version_group: "vg-1",
    });
    const versions = [
      { id: "att-1", version_number: 2, file_name: "plan-v2.pdf" },
      { id: "att-0", version_number: 1, file_name: "plan-v1.pdf" },
    ];
    vi.mocked(getAttachmentVersionHistory).mockResolvedValueOnce(versions);

    const req = buildRequest("/api/projects/proj-1/attachments/att-1/versions");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(2);
    expect(getAttachmentVersionHistory).toHaveBeenCalledWith("vg-1", "proj-1");
  });
});
