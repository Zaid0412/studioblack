import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPinComments,
  createPinComment,
  getAttachmentById,
  getPinCommentById,
  updatePinComment,
  updatePinCommentContent,
  deletePinComment,
  getPinCommentReplies,
} from "@/lib/queries";
import {
  GET,
  POST,
} from "@/app/api/projects/[id]/attachments/[attachmentId]/pins/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/projects/[id]/attachments/[attachmentId]/pins/[pinId]/route";
import { GET as GET_REPLIES } from "@/app/api/projects/[id]/attachments/[attachmentId]/pins/[pinId]/replies/route";
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
const PIN_ID = "pin-1";

const basePath = `/api/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}/pins`;
const pinPath = `${basePath}/${PIN_ID}`;

const baseParams = { id: PROJECT_ID, attachmentId: ATTACHMENT_ID };
const pinParams = { ...baseParams, pinId: PIN_ID };

const samplePin = {
  id: PIN_ID,
  attachment_id: ATTACHMENT_ID,
  user_id: TEST_USER_ID,
  x_percent: 50,
  y_percent: 50,
  page: 1,
  content: "Fix this area",
  resolved: false,
  created_at: "2024-06-01T00:00:00Z",
};

const sampleAttachment = {
  id: ATTACHMENT_ID,
  project_id: PROJECT_ID,
  file_name: "design.pdf",
  uploaded_by: "user-other",
};

const sampleReply = {
  id: "pin-reply-1",
  attachment_id: ATTACHMENT_ID,
  user_id: "user-other",
  parent_id: PIN_ID,
  content: "Done",
  created_at: "2024-06-02T00:00:00Z",
};

// ── GET .../pins ────────────────────────────────────────────────────────────

describe("GET .../pins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pins list", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinComments).mockResolvedValue([samplePin] as never);

    const req = buildRequest(basePath);
    const res = await GET(req, buildParams(baseParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([samplePin]);
    expect(getPinComments).toHaveBeenCalledWith(ATTACHMENT_ID);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(basePath);
    const res = await GET(req, buildParams(baseParams));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });
});

// ── POST .../pins ───────────────────────────────────────────────────────────

describe("POST .../pins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates pin with valid body", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(createPinComment).mockResolvedValue(samplePin as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "Fix this area",
        x_percent: 50,
        y_percent: 50,
        page: 1,
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(samplePin);
    expect(createPinComment).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: ATTACHMENT_ID,
        userId: TEST_USER_ID,
        content: "Fix this area",
        xPercent: 50,
        yPercent: 50,
        page: 1,
      })
    );
  });

  it("returns 400 on invalid body (empty content)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "",
        x_percent: 50,
        y_percent: 50,
        page: 1,
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("creates a rectangle annotation and derives centroid into x/y", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(createPinComment).mockResolvedValue(samplePin as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "highlight corner",
        page: 2,
        shape: { type: "rectangle", x: 10, y: 20, w: 30, h: 40 },
        shape_color: "#dc2626",
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(createPinComment).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "highlight corner",
        page: 2,
        xPercent: 25, // 10 + 30/2
        yPercent: 40, // 20 + 40/2
        shapeType: "rectangle",
        shapeData: { x: 10, y: 20, w: 30, h: 40 },
        shapeColor: "#dc2626",
      })
    );
  });

  it("creates a circle annotation using cx/cy as centroid", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(createPinComment).mockResolvedValue(samplePin as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "circle here",
        page: 1,
        shape: { type: "circle", cx: 60, cy: 70, rx: 5, ry: 8 },
        shape_color: "#0284c7",
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(createPinComment).toHaveBeenCalledWith(
      expect.objectContaining({
        xPercent: 60,
        yPercent: 70,
        shapeType: "circle",
        shapeData: { cx: 60, cy: 70, rx: 5, ry: 8 },
      })
    );
  });

  it("creates a freehand annotation with mean centroid", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);
    vi.mocked(createPinComment).mockResolvedValue(samplePin as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "scribble",
        page: 1,
        shape: {
          type: "freehand",
          points: [
            [0, 0],
            [10, 20],
            [20, 40],
          ],
        },
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(createPinComment).toHaveBeenCalledWith(
      expect.objectContaining({
        xPercent: 10, // (0+10+20)/3
        yPercent: 20, // (0+20+40)/3
        shapeType: "freehand",
        shapeData: {
          points: [
            [0, 0],
            [10, 20],
            [20, 40],
          ],
        },
        shapeColor: null,
      })
    );
  });

  it("rejects shape without page", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentById).mockResolvedValue(sampleAttachment as never);

    const req = buildRequest(basePath, {
      method: "POST",
      body: {
        content: "no page",
        shape: { type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
      },
    });
    const res = await POST(req, buildParams(baseParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: "page is required when posting a shape annotation",
    });
  });
});

// ── PATCH .../pins/[pinId] ──────────────────────────────────────────────────

describe("PATCH .../pins/[pinId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a pin", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinCommentById).mockResolvedValue(samplePin as never);
    const resolved = { ...samplePin, resolved: true };
    vi.mocked(updatePinComment).mockResolvedValue(resolved as never);

    const req = buildRequest(pinPath, {
      method: "PATCH",
      body: { resolved: true },
    });
    const res = await PATCH(req, buildParams(pinParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(resolved);
    expect(updatePinComment).toHaveBeenCalledWith(PIN_ID, true);
  });

  it("updates pin content", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinCommentById).mockResolvedValue(samplePin as never);
    const updated = { ...samplePin, content: "Updated text" };
    vi.mocked(updatePinCommentContent).mockResolvedValue(updated as never);

    const req = buildRequest(pinPath, {
      method: "PATCH",
      body: { content: "Updated text" },
    });
    const res = await PATCH(req, buildParams(pinParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updated);
    expect(updatePinCommentContent).toHaveBeenCalledWith(
      PIN_ID,
      "Updated text"
    );
  });
});

// ── DELETE .../pins/[pinId] ─────────────────────────────────────────────────

describe("DELETE .../pins/[pinId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("author can delete own pin", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinCommentById).mockResolvedValue(samplePin as never);
    vi.mocked(deletePinComment).mockResolvedValue(undefined as never);

    const req = buildRequest(pinPath, { method: "DELETE" });
    const res = await DELETE(req, buildParams(pinParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(deletePinComment).toHaveBeenCalledWith(PIN_ID);
  });

  it("returns 404 when pin not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinCommentById).mockResolvedValue(null as never);

    const req = buildRequest(pinPath, { method: "DELETE" });
    const res = await DELETE(req, buildParams(pinParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });
});

// ── GET .../pins/[pinId]/replies ────────────────────────────────────────────

describe("GET .../pins/[pinId]/replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns replies list", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getPinCommentById).mockResolvedValue(samplePin as never);
    vi.mocked(getPinCommentReplies).mockResolvedValue([sampleReply] as never);

    const req = buildRequest(`${pinPath}/replies`);
    const res = await GET_REPLIES(req, buildParams(pinParams));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleReply]);
    expect(getPinCommentReplies).toHaveBeenCalledWith(PIN_ID);
  });
});
