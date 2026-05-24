/**
 * Pin the latest-change-request endpoint used by the BOQ item drawer banner.
 * The query is exercised separately at the SQL level (boq.ts); this is the
 * thin route handler contract — 200 with the event, 200 with null when none.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLatestBoqItemChangeRequest, hasProjectAccess } from "@/lib/queries";
import { GET } from "@/app/api/projects/[id]/boq/items/[itemId]/latest-change-request/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "proj-1";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, mockSession());
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
});

describe("GET /api/projects/[id]/boq/items/[itemId]/latest-change-request", () => {
  it("returns the latest change-request event", async () => {
    vi.mocked(getLatestBoqItemChangeRequest).mockResolvedValue({
      actor_id: "user-1",
      actor_name: "Client Zaid",
      to_phase: "client_changes_requested",
      comment: "Lower the marble price",
      created_at: "2026-05-21T12:00:00.000Z",
    });
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/latest-change-request`
    );
    const res = await GET(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{
      actor_name: string;
      to_phase: string;
      comment: string;
    }>(res);
    expect(status).toBe(200);
    expect(body.actor_name).toBe("Client Zaid");
    expect(body.to_phase).toBe("client_changes_requested");
    expect(body.comment).toBe("Lower the marble price");
    expect(getLatestBoqItemChangeRequest).toHaveBeenCalledWith(ITEM_ID);
  });

  it("returns null when the item has never been kicked back", async () => {
    vi.mocked(getLatestBoqItemChangeRequest).mockResolvedValue(null);
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/latest-change-request`
    );
    const res = await GET(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toBeNull();
  });

  it("returns 403 when caller has no project access", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/latest-change-request`
    );
    const res = await GET(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });
});
