/**
 * Tests for the per-item lifecycle endpoints (Pap's 2026-05-12 spec):
 *
 *   - single: POST  /api/projects/[id]/boq/items/[itemId]/lifecycle
 *   - bulk:   POST  /api/projects/[id]/boq/items/bulk-lifecycle
 *
 * Both routes share the same permission rules via `canFirePhaseTransition`:
 *   - internal_review        — creator or PM
 *   - internally_approved    — PM or architect, AND NOT creator (4-eyes)
 *   - sent_to_client              — PM
 *   - client_reviewing            — auto-set on first client read (no manual fire)
 *   - client_approved             — client
 *   - client_changes_requested    — client
 *   - internal_changes_requested  — PM (covers internal kick-back + pull-back)
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
  getLastPhaseActors,
  getProjectClientInfo,
  getProjectStaffIds,
  getUsersByIds,
} from "@/lib/queries";
import { POST as PATCH_PHASE } from "@/app/api/projects/[id]/boq/items/[itemId]/lifecycle/route";
import { POST as BULK_PHASE } from "@/app/api/projects/[id]/boq/items/bulk-lifecycle/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
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
  overrides: Partial<
    NonNullable<Awaited<ReturnType<typeof getBoqItemContext>>>
  > = {}
): NonNullable<Awaited<ReturnType<typeof getBoqItemContext>>> {
  return {
    itemId: ITEM_ID,
    boqId: BOQ_ID,
    boqTitle: "Main BOQ",
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
  vi.mocked(getLastPhaseActors).mockResolvedValue(new Map());
  vi.mocked(getUsersByIds).mockResolvedValue([]);
});

/** Wait one macrotask so the route's fire-and-forget fan-out can complete. */
const flushFanOut = () => new Promise((r) => setTimeout(r, 0));

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
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
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
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
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
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(200);
  });

  it("non-creator architect can approve internally (200)", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
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
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(200);
  });

  it("architect who IS the creator cannot self-approve (4-eyes, 403)", async () => {
    // Same user is both the architect and the BOQ creator — 4-eyes rule
    // still blocks even though architects can now approve in general.
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
  });

  // PM pull-back: from any client-visible phase, PM can fire
  // internal_changes_requested → item leaves the client's view.
  for (const fromPhase of [
    "sent_to_client",
    "client_reviewing",
    "client_changes_requested",
    "client_approved",
  ] as const) {
    it(`PM can pull back from ${fromPhase} to internal_changes_requested`, async () => {
      vi.mocked(getBoqItemContext).mockResolvedValue(ctx({ phase: fromPhase }));
      vi.mocked(setBoqItemPhase).mockResolvedValue({
        ok: true,
        item: { ...baseItem, phase: "internal_changes_requested" },
      });

      const req = buildRequest(
        `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
        {
          method: "POST",
          body: {
            phase: "internal_changes_requested",
            comment: "needs revision",
          },
        }
      );
      const res = await PATCH_PHASE(
        req,
        buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
      );
      expect(res.status).toBe(200);
      expect(setBoqItemPhase).toHaveBeenCalledWith(
        ITEM_ID,
        "internal_changes_requested"
      );
    });
  }

  it("client cannot pull back to internal_changes_requested (403)", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "client_reviewing" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      {
        method: "POST",
        body: { phase: "internal_changes_requested", comment: "no" },
      }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
    expect(setBoqItemPhase).not.toHaveBeenCalled();
  });

  it("client can approve a sent-to-client item", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "client_reviewing" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "client_approved" },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "client_approved" } }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
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
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
  });

  it("requires comment for internal_changes_requested (400)", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internal_changes_requested" } }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(400);
    expect(setBoqItemPhase).not.toHaveBeenCalled();
  });

  it("permission gate fires before transition gate", async () => {
    // PM asks for client_approved straight from internal_review. The
    // permission gate (client-only on client_approved) rejects before
    // the state-machine ever sees the invalid transition.
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "client_approved" } }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
    expect(setBoqItemPhase).not.toHaveBeenCalled();
  });

  it("404s an unknown item", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internal_review" } }
    );
    const res = await PATCH_PHASE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /items/bulk-lifecycle ─────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/items/bulk-lifecycle", () => {
  it("PM advances 2 items from internal_review → internally_approved", async () => {
    vi.mocked(getBoq).mockResolvedValue({
      ...baseBoq,
      status: "draft",
    } as unknown as Boq);
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
    const { status, body } = await parseResponse<{
      items: BoqItemWithComputed[];
    }>(res);
    expect(status).toBe(200);
    expect(body.items).toHaveLength(2);
  });

  it("blocks creator self-approval on bulk (403)", async () => {
    // Signed-in user IS the BOQ creator → 4-eyes rule blocks internally_approved.
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(getBoq).mockResolvedValue({
      ...baseBoq,
      created_by: CREATOR_ID,
    } as unknown as Boq);

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
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as unknown as Boq);
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
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as unknown as Boq);
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

  it("requires comment for bulk internal_changes_requested (400)", async () => {
    vi.mocked(getBoq).mockResolvedValue({ ...baseBoq } as unknown as Boq);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-lifecycle`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID],
          phase: "internal_changes_requested",
        },
      }
    );
    const res = await BULK_PHASE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(400);
  });
});

// ── Notification fan-out ───────────────────────────────────────────────────

describe("phase notification fan-out", () => {
  it("internal_review → asks for eligible reviewers + batches user lookup", async () => {
    setupAuth(mocks.auth, creatorSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    vi.mocked(getBoqItemContext).mockResolvedValue(ctx({ phase: "draft" }));
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internal_review" },
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([PM_ID, ARCHITECT_ID]);
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: PM_ID, email: "pm@test.com", name: "PM" },
      { id: ARCHITECT_ID, email: "arch@test.com", name: "Arch" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internal_review" } }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    expect(getEligibleReviewers).toHaveBeenCalledWith({
      orgId: "org-test-001",
      creatorId: CREATOR_ID,
    });
    expect(getUsersByIds).toHaveBeenCalledWith([PM_ID, ARCHITECT_ID]);
  });

  it("internally_approved → notifies BOQ creator when submitter == creator", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internally_approved" },
    });
    // Submitter audit row points at the creator (the BOQ owner submitted).
    vi.mocked(getLastPhaseActors).mockResolvedValue(
      new Map([[ITEM_ID, CREATOR_ID]])
    );
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: CREATOR_ID, email: "creator@test.com", name: "Creator" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    expect(getUsersByIds).toHaveBeenCalledWith([CREATOR_ID]);
    expect(getEligibleReviewers).not.toHaveBeenCalled();
  });

  it("internally_approved → also notifies the submitter when they are not the creator", async () => {
    const SUBMITTER_ID = "user-submitter";
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internally_approved" },
    });
    // A different PM submitted the item for review — they should hear about
    // the approval too, not just the BOQ creator.
    vi.mocked(getLastPhaseActors).mockResolvedValue(
      new Map([[ITEM_ID, SUBMITTER_ID]])
    );
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: CREATOR_ID, email: "creator@test.com", name: "Creator" },
      { id: SUBMITTER_ID, email: "sub@test.com", name: "Submitter" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    // Set semantics — order isn't guaranteed.
    const recipientIds = vi.mocked(getUsersByIds).mock.calls[0][0] as string[];
    expect(recipientIds).toHaveLength(2);
    expect(new Set(recipientIds)).toEqual(new Set([CREATOR_ID, SUBMITTER_ID]));
  });

  it("internally_approved → excludes the approving actor from recipients", async () => {
    // The architect (ARCHITECT_ID) is approving, but they also happen to be
    // the recorded submitter. They shouldn't get notified about their own
    // action — the creator is the only recipient left.
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getOrgRole).mockResolvedValue("member");
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internally_approved" },
    });
    vi.mocked(getLastPhaseActors).mockResolvedValue(
      new Map([[ITEM_ID, ARCHITECT_ID]])
    );
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: CREATOR_ID, email: "creator@test.com", name: "Creator" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "internally_approved" } }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    expect(getUsersByIds).toHaveBeenCalledWith([CREATOR_ID]);
  });

  it("client_changes_requested → fans out to every project PM + architect (not just BOQ creator)", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null);
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "client_reviewing" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "client_changes_requested" },
    });
    vi.mocked(getProjectStaffIds).mockResolvedValue([
      PM_ID,
      ARCHITECT_ID,
      CREATOR_ID, // creator may also be in project_member; should be de-duped
    ]);
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: PM_ID, email: "pm@test.com", name: "PM" },
      { id: ARCHITECT_ID, email: "arch@test.com", name: "Arch" },
      { id: CREATOR_ID, email: "creator@test.com", name: "Creator" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      {
        method: "POST",
        body: {
          phase: "client_changes_requested",
          comment: "Lower the marble price",
        },
      }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    expect(getProjectStaffIds).toHaveBeenCalledWith(PROJECT_ID);
    expect(getUsersByIds).toHaveBeenCalledTimes(1);
    const recipientIds = vi.mocked(getUsersByIds).mock.calls[0][0] as string[];
    expect(recipientIds.sort()).toEqual(
      [PM_ID, ARCHITECT_ID, CREATOR_ID].sort()
    );
  });

  it("internal_changes_requested → excludes the actor from recipients", async () => {
    // Actor IS the BOQ creator AND a project PM. Should still not notify
    // themselves.
    setupAuth(mocks.auth, mockSession({ id: PM_ID }));
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internal_review", boqCreatorId: PM_ID })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "internal_changes_requested" },
    });
    vi.mocked(getProjectStaffIds).mockResolvedValue([PM_ID, ARCHITECT_ID]);
    vi.mocked(getUsersByIds).mockResolvedValue([
      { id: ARCHITECT_ID, email: "arch@test.com", name: "Arch" },
    ]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      {
        method: "POST",
        body: {
          phase: "internal_changes_requested",
          comment: "needs revision",
        },
      }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    const recipientIds = vi.mocked(getUsersByIds).mock.calls[0][0] as string[];
    expect(recipientIds).toEqual([ARCHITECT_ID]);
    expect(recipientIds).not.toContain(PM_ID);
  });

  it("sent_to_client → looks up project's client email", async () => {
    vi.mocked(getBoqItemContext).mockResolvedValue(
      ctx({ phase: "internally_approved" })
    );
    vi.mocked(setBoqItemPhase).mockResolvedValue({
      ok: true,
      item: { ...baseItem, phase: "sent_to_client" },
    });
    vi.mocked(getProjectClientInfo).mockResolvedValue({
      project_name: "Test Project",
      client_email: "client@example.com",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/lifecycle`,
      { method: "POST", body: { phase: "sent_to_client" } }
    );
    await PATCH_PHASE(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));
    await flushFanOut();

    expect(getProjectClientInfo).toHaveBeenCalledWith(PROJECT_ID);
    expect(getUsersByIds).not.toHaveBeenCalled();
  });
});
