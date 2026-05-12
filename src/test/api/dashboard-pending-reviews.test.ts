import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPendingReviews, getPendingBoqReviews } from "@/lib/queries";
import { GET } from "@/app/api/dashboard/pending-reviews/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
} from "../helpers";
import { mocks } from "../setup";

const fakeFiles = [
  {
    id: "att-1",
    project_id: "proj-1",
    project_name: "Karaköy Loft",
    file_name: "2D Layout v3.pdf",
    version: 3,
    uploaded_at: "2026-05-06T07:00:00Z",
    uploaded_by_name: "Mehmet",
  },
  {
    id: "att-2",
    project_id: "proj-2",
    project_name: "Beşiktaş Office",
    file_name: "Plumbing Section View v1.pdf",
    version: 1,
    uploaded_at: "2026-05-05T19:00:00Z",
    uploaded_by_name: "Aisha",
  },
];

const fakeBoqs = [
  {
    id: "boq-1",
    project_id: "proj-3",
    project_name: "Marina Towers",
    submitted_at: "2026-05-07T10:00:00Z",
    submitted_by_name: "Karim",
  },
];

describe("GET /api/dashboard/pending-reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns files and boqs for the user's org", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getPendingReviews).mockResolvedValue(fakeFiles as never);
    vi.mocked(getPendingBoqReviews).mockResolvedValue(fakeBoqs as never);

    const res = await GET(buildRequest("/api/dashboard/pending-reviews"));
    const { status, body } = await parseResponse<{
      files: typeof fakeFiles;
      boqs: typeof fakeBoqs;
    }>(res);

    expect(status).toBe(200);
    expect(body.files).toHaveLength(2);
    expect(body.files[0].file_name).toBe("2D Layout v3.pdf");
    expect(body.boqs).toHaveLength(1);
    expect(body.boqs[0].project_name).toBe("Marina Towers");
    expect(getPendingReviews).toHaveBeenCalledWith(TEST_ORG_ID);
    expect(getPendingBoqReviews).toHaveBeenCalledWith(TEST_ORG_ID);
  });

  it("returns empty groups when the session has no active org", async () => {
    setupAuth(
      mocks.auth,
      mockSession({}, { activeOrganizationId: null as unknown as string })
    );

    const res = await GET(buildRequest("/api/dashboard/pending-reviews"));
    const { status, body } = await parseResponse<{
      files: unknown[];
      boqs: unknown[];
    }>(res);

    expect(status).toBe(200);
    expect(body.files).toEqual([]);
    expect(body.boqs).toEqual([]);
    expect(getPendingReviews).not.toHaveBeenCalled();
    expect(getPendingBoqReviews).not.toHaveBeenCalled();
  });

  it("rejects clients", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));

    const res = await GET(buildRequest("/api/dashboard/pending-reviews"));
    expect(res.status).toBe(403);
    expect(getPendingReviews).not.toHaveBeenCalled();
    expect(getPendingBoqReviews).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    setupAuth(mocks.auth, null);

    const res = await GET(buildRequest("/api/dashboard/pending-reviews"));
    expect(res.status).toBe(401);
  });
});
