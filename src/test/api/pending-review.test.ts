import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/projects/[id]/tasks/pending-review/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const { getTasksPendingReview } = await import("@/lib/queries");

const PARAMS = buildParams({ id: "proj-1" });

describe("GET /api/projects/[id]/tasks/pending-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1/tasks/pending-review");
    const res = await GET(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns empty array when no tasks pending", async () => {
    vi.mocked(getTasksPendingReview).mockResolvedValueOnce([]);

    const req = buildRequest("/api/projects/proj-1/tasks/pending-review");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns tasks pending review", async () => {
    const tasks = [
      { id: "t1", title: "Layout", status: "pending_review" },
      { id: "t2", title: "Colors", status: "pending_review" },
    ];
    vi.mocked(getTasksPendingReview).mockResolvedValueOnce(tasks);

    const req = buildRequest("/api/projects/proj-1/tasks/pending-review");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("t1");
    expect(getTasksPendingReview).toHaveBeenCalledWith("proj-1");
  });
});
