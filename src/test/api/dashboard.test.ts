import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardStats, getRecentActivity } from "@/lib/queries";
import { GET } from "@/app/api/dashboard/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── GET /api/dashboard ──────────────────────────────────────────────────────

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/dashboard");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns dashboard stats", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const statsData = {
      active: 3,
      pending: 2,
      approved: 5,
      team_members: 4,
      deadlines: [{ id: "d1", name: "Deadline 1" }],
    };
    const activityData = [
      { id: "a1", type: "comment", message: "New comment" },
    ];

    vi.mocked(getDashboardStats).mockResolvedValue(statsData as never);
    vi.mocked(getRecentActivity).mockResolvedValue(activityData as never);

    const req = buildRequest("/api/dashboard");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({
      stats: {
        active: 3,
        pendingReviews: 2,
        approved: 5,
        teamMembers: 4,
      },
      deadlines: [{ id: "d1", name: "Deadline 1" }],
      recentActivity: activityData,
    });
    expect(getDashboardStats).toHaveBeenCalledWith(TEST_ORG_ID);
    expect(getRecentActivity).toHaveBeenCalledWith(TEST_USER_ID, 10);
  });

  it("returns empty stats when no org found", async () => {
    const session = mockSession({}, { activeOrganizationId: null });
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/dashboard");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({
      stats: { active: 0, pendingReviews: 0, approved: 0, teamMembers: 0 },
      deadlines: [],
      recentActivity: [],
    });
  });
});
