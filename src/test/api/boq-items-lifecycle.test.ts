/**
 * Tests for the per-item lifecycle endpoints (Pap's 2026-05-12 spec):
 *
 *   - single: POST  /api/projects/[id]/boq/items/[itemId]/lifecycle
 *   - bulk:   POST  /api/projects/[id]/boq/items/bulk-lifecycle
 *
 * Both routes share the same permission rules via `canFirePhaseTransition`:
 *   - internal_review        — creator or PM
 *   - internally_approved    — PM, AND NOT creator (4-eyes)
 *   - submitted_to_client    — PM
 *   - client_approved        — client
 *   - change_requested       — PM or client
 *   - draft                  — creator or PM
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBoqItemContext,
  setBoqItemPhase,
  setBoqItemsPhase,
  getBoq,
  hasProjectAccess,
  getOrgRole,
  getEligibleReviewers,
} from "@/lib/queries";
import { POST as PATCH_PHASE } from "@/app/api/projects/[id]/boq/items/[itemId]/lifecycle/route";
import { POST as BULK_PHASE } from "@/app/api/projects/[id]/boq/items/bulk-lifecycle/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";
import type { Boq, BoqItemWithComputed } from "@/types";

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440001";
const ITEM_ID_2 = "660e8400-e29b-41d4-a716-446655440002";
const CREATOR_ID = "user-creator";
const PM_ID = "user-pm";
const ARCHITECT_ID = "user-architect";

const pmSession = mockSession({ id: PM_ID });
const creatorSession = mockSession({ id: CREATOR_ID });
const architectSession = mockSession({ id: ARCHITECT_ID });
const clientSession = mockSession({ id: "user-client", role: "client" });

function ctx(
  overrides: Partial<Awaited<ReturnType<typeof getBoqItemContext>>> = {}
): Awaited<ReturnType<typeof getBoqItemContext>> {
  return {
    itemId: ITEM_ID,
    boqId: BOQ_ID,
    boqTitle: "Main BOQ",
    boqStatus: "draft" as Boq["status"],
    boqCreatorId: CREATOR_ID,
    orgId: "org-test-001",
    projectId: PROJECT_ID,
    phase: "draft",
    ...overrides,
  };
}

const baseItem = {
  id: ITEM_ID,
  boq_id: BOQ_ID,
  phase: "internal_review",
} as unknown as BoqItemWithComputed;

const baseBoq = {
  id: BOQ_ID,
  project_id: PROJECT_ID,
  title: "Main BOQ",
  status: "draft" as Boq["status"],
  created_by: CREATOR_ID,
} as unknown as Boq;

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getOrgRole).mockResolvedValue("owner");
  vi.mocked(getEligibleReviewers).mockResolvedValue([]);
});

// ── POST /items/[itemId]/lifecycle ─────────────────────────────────────────

describe("POST /api/projects/[id]/boq/items/[itemId]/lifecycle", () => {
  it("creator can submit a draft for internal review", async () => {
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("member"); // architect
    vi.mocked(getBoqItemContext).mockResolvedValue(ctx({ phase: "draft" }));
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internal_review" },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internal_review" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(200);
    expect(setBoqItemPhase).toHaveBeenCalledWith(ITEM_ID, "internal_review");
  });

  it("blocks creator self-approval — internally_approved (403)", async () => {
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("owner"); // creator happens to be a PM too
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(403);
    expect(setBoqItemPhase).not.toHaveBeenCalled();
  });

  it("PM (non-creator) can approve internally", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internally_approved" },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(200);
  });

  it("non-PM architect cannot approve internally (403)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(403);
  });

  it("client can approve a submitted-to-client item", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "submitted_to_client" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "client_approved" },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "client_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(200);
  });

  it("client cannot approve internally (403)", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(403);
  });

  it("requires comment for change_requested (400)", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "change_requested" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(400);
    expect(setBoqItemPhase).not.toHaveBeenCalled();
  });

  it("rejects invalid transition (422)", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: false,
      reason: "invalid_transition",
      from: "internal_review",
    });

    // Caller asks for client_approved straight from internal_review — not allowed.
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "client_approved" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    // permission gate fires first for non-client actor → 403
    expect(res.status).toBe(403);
  });

  it("rejects locked BOQ (423)", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internally_approved", boqStatus: "locked" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "submitted_to_client" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(423);
  });

  it("404s an unknown item", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internal_review" } }
    );
    const res = await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    expect(res.status).toBe(404);
  });
});

// ── POST /items/bulk-lifecycle ─────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/items/bulk-lifecycle", () => {
  it("PM advances 2 items from internal_review → internally_approved", async () => {
    vi.mocked(getBoq).mockResolvedValue({
      ...baseBoq,
      status: "draft",
    } as never);
    vi.mocked(setBoqItemsPhase).mockResolvedValue({
      ok: true,
      items: [
        { ...baseItem, id: ITEM_ID, phase: "internally_approved" },
        { ...baseItem, id: ITEM_ID_2, phase: "internally_approved" },
      ],
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID, ITEM_ID_2],
          phase: "internally_approved",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ items: BoqItemWithComputed[] }>(res);
    expect(status).toBe(200);
    expect(body.items).toHaveLength(2);
  });

  it("blocks creator self-approval on bulk (403)", async () => {
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(getBoq).mockResolvedValue({
      ...baseBoq,
      created_by: TEST_USER_ID === CREATOR_ID ? CREATOR_ID : CREATOR_ID,
    } as never);
    // The signed-in user IS the BOQ creator.
    vi.mocked(getBoq).mockResolvedValue({
      ...baseBoq,
      created_by: CREATOR_ID,
    } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID],
          phase: "internally_approved",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
    expect(setBoqItemsPhase).not.toHaveBeenCalled();
  });

  it("rolls back when any item has an invalid source phase (422)", async () => {
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as never);
    vi.mocked(setBoqItemsPhase).mockResolvedValue({
      ok: false,
      reason: "invalid_transition",
      blockedIds: [ITEM_ID_2],
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID, ITEM_ID_2],
          phase: "internally_approved",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{
      blockedIds: string[];
    }>(res);
    expect(status).toBe(422);
    expect(body.blockedIds).toEqual([ITEM_ID_2]);
  });

  it("404s when itemIds span the wrong BOQ", async () => {
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as never);
    vi.mocked(setBoqItemsPhase).mockResolvedValue({
      ok: false,
      reason: "wrong_boq",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID],
          phase: "internally_approved",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(404);
  });

  it("requires comment for bulk change_requested (400)", async () => {
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID],
          phase: "change_requested",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(400);
  });

  it("rejects locked BOQ (423)", async () => {
    // parseBoqRequest's gate uses getBoqStatus, not getBoq — mock that.
    const { getBoqStatus } = await import("@/lib/queries");
    vi.mocked(getBoqStatus).mockResolvedValue("locked");

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID],
          phase: "internally_approved",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(423);
  });
});
