import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/notifications/route";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationsReadByIds,
  deleteNotification,
  deleteAllNotifications,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";

const UUID_1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UUID_2 = "b1ffcd00-ad1c-4f09-bb7e-7ccace491b22";

const authMocks = {
  getSession: vi.mocked(auth.api.getSession),
  listOrganizations: vi.mocked(auth.api.listOrganizations),
  listMembers: vi.mocked(auth.api.listMembers),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/notifications ──────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  it("returns 401 without session", async () => {
    setupAuth(authMocks, null);

    const req = buildRequest("/api/notifications");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns notifications list", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const fakeNotifications = [
      { id: "n1", user_id: session.user.id, type: "task_assigned", read: false },
      { id: "n2", user_id: session.user.id, type: "comment_added", read: true },
    ];
    vi.mocked(getNotifications).mockResolvedValue(fakeNotifications);

    const req = buildRequest("/api/notifications");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(fakeNotifications);
    expect(getNotifications).toHaveBeenCalledWith(session.user.id);
  });

  it("returns unread count when ?unread=true", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    vi.mocked(getUnreadNotificationCount).mockResolvedValue(5);

    const req = buildRequest("/api/notifications", {
      searchParams: { unread: "true" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ count: 5 });
    expect(getUnreadNotificationCount).toHaveBeenCalledWith(session.user.id);
  });
});

// ── PATCH /api/notifications ────────────────────────────────────────────────

describe("PATCH /api/notifications", () => {
  it("marks all as read", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const req = buildRequest("/api/notifications", {
      method: "PATCH",
      body: { markAllRead: true },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(markAllNotificationsRead).toHaveBeenCalledWith(session.user.id);
  });

  it("marks specific IDs as read", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const ids = [
      UUID_1,
      UUID_2,
    ];
    const req = buildRequest("/api/notifications", {
      method: "PATCH",
      body: { ids },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(markNotificationsReadByIds).toHaveBeenCalledWith(
      session.user.id,
      ids
    );
  });

  it("returns 400 on invalid body", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const req = buildRequest("/api/notifications", {
      method: "PATCH",
      body: { ids: "not-an-array" },
    });
    const res = await PATCH(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

// ── DELETE /api/notifications ───────────────────────────────────────────────

describe("DELETE /api/notifications", () => {
  it("deletes a single notification", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const req = buildRequest("/api/notifications", {
      method: "DELETE",
      body: { id: UUID_1 },
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(deleteNotification).toHaveBeenCalledWith(
      session.user.id,
      UUID_1
    );
  });

  it("deletes all notifications", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const req = buildRequest("/api/notifications", {
      method: "DELETE",
      body: {},
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(deleteAllNotifications).toHaveBeenCalledWith(session.user.id);
  });

  it("returns 400 on invalid body", async () => {
    const session = mockSession();
    setupAuth(authMocks, session);

    const req = buildRequest("/api/notifications", {
      method: "DELETE",
      body: { id: 12345 },
    });
    const res = await DELETE(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
