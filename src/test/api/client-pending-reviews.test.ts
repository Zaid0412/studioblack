/**
 * GET /api/client/pending-reviews — the dashboard popover that surfaces
 * files + BOQs awaiting the caller's decision.
 *
 * Pins:
 *   - Only `client` role can read this — it leaks no org-wide data, but
 *     mirroring the role gate on the dashboard side keeps the surface
 *     tight.
 *   - The query is scoped by `user.email`; a typo or session swap must
 *     not silently widen the result.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getClientPendingReviews } from "@/lib/queries";
import { GET } from "@/app/api/client/pending-reviews/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

describe("GET /api/client/pending-reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-client role", async () => {
    setupAuth(mocks.auth, mockSession({ role: "pm" }));
    const res = await GET(buildRequest("/api/client/pending-reviews"));
    expect(res.status).toBe(403);
  });

  it("returns empty payload for a client with nothing pending", async () => {
    setupAuth(
      mocks.auth,
      mockSession({ role: "client", email: "client@test.com" })
    );
    const res = await GET(buildRequest("/api/client/pending-reviews"));
    const { status, body } = await parseResponse<{
      files: unknown[];
      boqs: unknown[];
      total: number;
    }>(res);
    expect(status).toBe(200);
    expect(body).toEqual({ files: [], boqs: [], total: 0 });
  });

  it("returns files, BOQs, and total when present", async () => {
    setupAuth(
      mocks.auth,
      mockSession({ role: "client", email: "client@test.com" })
    );
    vi.mocked(getClientPendingReviews).mockResolvedValueOnce({
      files: [
        {
          id: "f-1",
          project_id: "p-1",
          project_name: "P1",
          file_name: "design.pdf",
          version: 1,
          sent_at: "2026-05-14T00:00:00Z",
        },
      ],
      boqs: [
        {
          id: "b-1",
          project_id: "p-1",
          project_name: "P1",
          submitted_at: "2026-05-14T00:00:00Z",
          items_in_review: 3,
        },
      ],
      total: 2,
    });

    const res = await GET(buildRequest("/api/client/pending-reviews"));
    const { status, body } = await parseResponse<{
      files: unknown[];
      boqs: unknown[];
      total: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.files).toHaveLength(1);
    expect(body.boqs).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it("scopes the query to the caller's email", async () => {
    setupAuth(
      mocks.auth,
      mockSession({ role: "client", email: "alice@test.com" })
    );
    await GET(buildRequest("/api/client/pending-reviews"));
    expect(vi.mocked(getClientPendingReviews)).toHaveBeenCalledWith(
      "alice@test.com"
    );
  });
});
