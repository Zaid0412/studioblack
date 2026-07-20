import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProjectOverview,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { GET } from "@/app/api/projects/[id]/overview/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { ProjectOverview } from "@/types";

const PROJECT_ID = "proj-1";
const URL_ = `/api/projects/${PROJECT_ID}/overview`;

const STUDIO_OVERVIEW: ProjectOverview = {
  kpis: {
    designFiles: 12,
    pendingReviews: 3,
    boqValue: "8500000",
    boqLineCount: 128,
    openOrders: 2,
  },
  designStatus: [
    { status: "approved", count: 7 },
    { status: "pending", count: 3 },
    { status: "rejected", count: 2 },
  ],
  chart: {
    kind: "cost_by_division",
    bars: [{ label: "Civil", value: 4000000 }],
  },
  activity: [],
};

const call = () => GET(buildRequest(URL_), buildParams({ id: PROJECT_ID }));

describe("GET /api/projects/[id]/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const { status } = await parseResponse(await call());

    expect(status).toBe(401);
  });

  it("returns the aggregated overview for a studio member", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectOverview).mockResolvedValue(STUDIO_OVERVIEW);

    const { status, body } = await parseResponse(await call());

    expect(status).toBe(200);
    expect(body).toEqual(STUDIO_OVERVIEW);
    // Studio member → resolved effective role passed through (owner → pm).
    expect(getProjectOverview).toHaveBeenCalledWith(PROJECT_ID, "pm");
  });

  it("passes the client role through so the query scopes the payload", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);
    vi.mocked(getProjectOverview).mockResolvedValue({
      ...STUDIO_OVERVIEW,
      kpis: { ...STUDIO_OVERVIEW.kpis, openOrders: null },
      chart: { kind: "design_progress_by_phase", bars: [] },
    });

    const { status } = await parseResponse(await call());

    expect(status).toBe(200);
    expect(getProjectOverview).toHaveBeenCalledWith(PROJECT_ID, "client");
  });

  it("enforces project access (403 when not a member)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const { status } = await parseResponse(await call());

    expect(status).toBe(403);
    expect(getProjectOverview).not.toHaveBeenCalled();
  });
});
