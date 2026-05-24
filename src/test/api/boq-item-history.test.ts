/**
 * Tests for GET /api/projects/[id]/boq/items/[itemId]/history.
 *
 * Pins the route's two main jobs:
 *   1. Look up the item's BOQ context, then call `getBoqItemHistory` with
 *      the right ids — feeds the Activity tab in `BoqItemDrawer`.
 *   2. Scrub the result for external viewers: drop transitions whose both
 *      endpoints are studio-internal so the client never sees the studio's
 *      draft/internal-review churn.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBoqItemContext,
  getBoqItemHistory,
  hasProjectAccess,
  getOrgRole,
} from "@/lib/queries";
import { GET as HISTORY } from "@/app/api/projects/[id]/boq/items/[itemId]/history/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { BoqItemHistoryEvent } from "@/types";

const PROJECT_ID = "proj-1";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORG_ID = "org-test-001";

const pmSession = mockSession({ id: "user-pm" });
const clientSession = mockSession({ id: "user-client", role: "client" });

const baseCtx = {
  itemId: ITEM_ID,
  boqId: BOQ_ID,
  boqTitle: "Main BOQ",
  boqCreatorId: "user-creator",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  phase: "draft" as const,
  clientEmail: null,
};

function ev(overrides: Partial<BoqItemHistoryEvent>): BoqItemHistoryEvent {
  return {
    id: "ev-1",
    actor_id: "user-pm",
    actor_name: "Zaid Khan",
    actor_role: "pm",
    from_phase: "internal_review",
    to_phase: "internally_approved",
    comment: null,
    is_bulk: false,
    bulk_item_count: null,
    created_at: "2026-05-20T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getOrgRole).mockResolvedValue("owner");
  vi.mocked(getBoqItemContext).mockResolvedValue(baseCtx);
});

describe("GET boq item history", () => {
  it("returns the events fetched from getBoqItemHistory unchanged for staff", async () => {
    const events = [
      ev({
        id: "a",
        to_phase: "client_approved",
        from_phase: "client_reviewing",
      }),
      ev({
        id: "b",
        to_phase: "internally_approved",
        from_phase: "internal_review",
      }),
    ];
    vi.mocked(getBoqItemHistory).mockResolvedValue(events);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/history`
    );
    const res = await HISTORY(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{
      events: BoqItemHistoryEvent[];
    }>(res);

    expect(status).toBe(200);
    expect(body.events).toEqual(events);
    expect(getBoqItemHistory).toHaveBeenCalledWith({
      itemId: ITEM_ID,
      boqId: BOQ_ID,
      orgId: ORG_ID,
      clientEmail: null,
    });
  });

  it("404s when the item is not found in this project", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/history`
    );
    const res = await HISTORY(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
    expect(getBoqItemHistory).not.toHaveBeenCalled();
  });

  it("scrubs pure-internal transitions for external viewers", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);

    const events = [
      // internal-only churn — must be dropped for the client
      ev({
        id: "internal-only",
        from_phase: "internal_review",
        to_phase: "internally_approved",
      }),
      // creation-style row (no from) for the very first event — also dropped
      ev({ id: "creation", from_phase: null, to_phase: "draft" }),
      // touches client-visible side — keep
      ev({
        id: "sent",
        from_phase: "internally_approved",
        to_phase: "sent_to_client",
      }),
      // both client-visible — keep
      ev({
        id: "approve",
        from_phase: "client_reviewing",
        to_phase: "client_approved",
      }),
    ];
    vi.mocked(getBoqItemHistory).mockResolvedValue(events);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/history`
    );
    const res = await HISTORY(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{
      events: BoqItemHistoryEvent[];
    }>(res);

    expect(status).toBe(200);
    expect(body.events.map((e) => e.id)).toEqual(["sent", "approve"]);
  });
});
