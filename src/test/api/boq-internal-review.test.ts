/**
 * Tests for the internal-review endpoints under /api/projects/[id]/boq.
 *
 *   - submit-for-review  → POST  /submit-for-review
 *   - approve            → POST  /approve
 *   - request-changes    → POST  /request-changes
 *   - cancel-review      → POST  /cancel-review
 *
 * The 4-eyes rule is enforced via `getEligibleReviewers` (PMs +
 * architects on the project, NOT the BOQ creator). Each route stamps
 * its own audit columns on the boq row + writes an `audit_event`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBoqByProject,
  getBoq,
  submitBoqForReview,
  approveBoqInternally,
  requestBoqChanges,
  cancelBoqReview,
  getEligibleReviewers,
  hasProjectAccess,
} from "@/lib/queries";
import { POST as SUBMIT } from "@/app/api/projects/[id]/boq/submit-for-review/route";
import { POST as APPROVE } from "@/app/api/projects/[id]/boq/approve/route";
import { POST as REQUEST_CHANGES } from "@/app/api/projects/[id]/boq/request-changes/route";
import { POST as CANCEL } from "@/app/api/projects/[id]/boq/cancel-review/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";
import type { Boq, BoqWithDetails } from "@/types";

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEWER_USER_ID = "user-test-reviewer";
const OTHER_USER_ID = "user-test-other";

const baseBoq: Boq = {
  id: BOQ_ID,
  project_id: PROJECT_ID,
  title: "Main BOQ",
  version: 1,
  status: "draft",
  currency: "USD",
  exchange_rate: "1",
  contingency_pct: "5",
  vat_pct: "18",
  minimum_margin_pct: "10",
  client_id: null,
  architect_id: null,
  issued_date: null,
  approved_date: null,
  notes: null,
  client_notes: null,
  snapshot: null,
  created_by: TEST_USER_ID,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  internal_review_submitted_at: null,
  internal_review_submitted_by: null,
  internally_approved_at: null,
  internally_approved_by: null,
  changes_requested_at: null,
  changes_requested_by: null,
  changes_requested_comment: null,
};

const fullBoqOf = (b: Boq): BoqWithDetails => ({
  ...b,
  sections: [],
  items: [],
  summary: {
    total_cost: "0",
    total_sell_price: "0",
    subtotal: "0",
    pre_vat_total: "0",
    client_total: "0",
    average_margin_pct: "0",
    margin_bleed_count: 0,
    pending_approvals: 0,
    item_count: 0,
    section_totals: [],
  },
});

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });
const reviewerSession = mockSession({ id: REVIEWER_USER_ID });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
});

// ── POST /submit-for-review ─────────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/submit-for-review", () => {
  it("flips draft → pending_internal_review (creator)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(baseBoq);
    const submitted: Boq = { ...baseBoq, status: "pending_internal_review" };
    vi.mocked(submitBoqForReview).mockResolvedValue(submitted);
    vi.mocked(getBoq).mockResolvedValue(fullBoqOf(submitted));
    vi.mocked(getEligibleReviewers).mockResolvedValue([]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqWithDetails>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("pending_internal_review");
    expect(submitBoqForReview).toHaveBeenCalledWith({
      boqId: BOQ_ID,
      submittedBy: TEST_USER_ID,
    });
  });

  it("allows changes_requested → pending_internal_review (creator resubmits)", async () => {
    const fromChanges: Boq = { ...baseBoq, status: "changes_requested" };
    vi.mocked(getBoqByProject).mockResolvedValue(fromChanges);
    const submitted: Boq = { ...baseBoq, status: "pending_internal_review" };
    vi.mocked(submitBoqForReview).mockResolvedValue(submitted);
    vi.mocked(getBoq).mockResolvedValue(fullBoqOf(submitted));

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(submitBoqForReview).toHaveBeenCalled();
  });

  it("rejects a non-creator (403)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      created_by: OTHER_USER_ID,
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
    expect(submitBoqForReview).not.toHaveBeenCalled();
  });

  it("rejects a status that's not draft or changes_requested (422)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "client_approved",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(422);
    expect(body.code).toBe("INVALID_STATUS_TRANSITION");
    expect(submitBoqForReview).not.toHaveBeenCalled();
  });

  it("returns 404 when no BOQ exists for the project", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("rejects client role (403)", async () => {
    setupAuth(mocks.auth, clientSession);
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/submit-for-review`,
      { method: "POST" }
    );
    const res = await SUBMIT(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
  });
});

// ── POST /approve ───────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/approve", () => {
  it("flips pending_internal_review → internally_approved (eligible reviewer)", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([REVIEWER_USER_ID]);
    const approved: Boq = { ...baseBoq, status: "internally_approved" };
    vi.mocked(approveBoqInternally).mockResolvedValue(approved);
    vi.mocked(getBoq).mockResolvedValue(fullBoqOf(approved));

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/approve`, {
      method: "POST",
      body: {},
    });
    const res = await APPROVE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqWithDetails>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("internally_approved");
    expect(approveBoqInternally).toHaveBeenCalledWith({
      boqId: BOQ_ID,
      approvedBy: REVIEWER_USER_ID,
    });
  });

  it("accepts an optional comment", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([REVIEWER_USER_ID]);
    vi.mocked(approveBoqInternally).mockResolvedValue({
      ...baseBoq,
      status: "internally_approved",
    });
    vi.mocked(getBoq).mockResolvedValue(
      fullBoqOf({ ...baseBoq, status: "internally_approved" })
    );

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/approve`, {
      method: "POST",
      body: { comment: "Looks great." },
    });
    const res = await APPROVE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(200);
  });

  it("rejects creator self-approval (403)", async () => {
    // The signed-in pmSession user IS the BOQ creator → not eligible.
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue(["user-someone-else"]);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/approve`, {
      method: "POST",
      body: {},
    });
    const res = await APPROVE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
    expect(approveBoqInternally).not.toHaveBeenCalled();
  });

  it("rejects approve when status isn't pending_internal_review (422)", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "draft",
    });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/approve`, {
      method: "POST",
      body: {},
    });
    const res = await APPROVE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(422);
    expect(body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("rejects client role (403)", async () => {
    setupAuth(mocks.auth, clientSession);
    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/approve`, {
      method: "POST",
      body: {},
    });
    const res = await APPROVE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
  });
});

// ── POST /request-changes ───────────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/request-changes", () => {
  it("flips pending_internal_review → changes_requested with comment", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([REVIEWER_USER_ID]);
    const requested: Boq = {
      ...baseBoq,
      status: "changes_requested",
      changes_requested_comment: "Margin on Section 2 looks low.",
    };
    vi.mocked(requestBoqChanges).mockResolvedValue(requested);
    vi.mocked(getBoq).mockResolvedValue(fullBoqOf(requested));

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/request-changes`,
      {
        method: "POST",
        body: { comment: "Margin on Section 2 looks low." },
      }
    );
    const res = await REQUEST_CHANGES(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqWithDetails>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("changes_requested");
    expect(requestBoqChanges).toHaveBeenCalledWith({
      boqId: BOQ_ID,
      requestedBy: REVIEWER_USER_ID,
      comment: "Margin on Section 2 looks low.",
    });
  });

  it("rejects an empty comment (400)", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([REVIEWER_USER_ID]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/request-changes`,
      { method: "POST", body: { comment: "   " } }
    );
    const res = await REQUEST_CHANGES(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(400);
    expect(requestBoqChanges).not.toHaveBeenCalled();
  });

  it("rejects a missing comment (400)", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue([REVIEWER_USER_ID]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/request-changes`,
      { method: "POST", body: {} }
    );
    const res = await REQUEST_CHANGES(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(400);
  });

  it("rejects creator self (403)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    vi.mocked(getEligibleReviewers).mockResolvedValue(["user-someone-else"]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/request-changes`,
      { method: "POST", body: { comment: "Fix the margin" } }
    );
    const res = await REQUEST_CHANGES(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
  });

  it("rejects wrong status (422)", async () => {
    setupAuth(mocks.auth, reviewerSession);
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "internally_approved",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/request-changes`,
      { method: "POST", body: { comment: "Hmm." } }
    );
    const res = await REQUEST_CHANGES(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(422);
    expect(body.code).toBe("INVALID_STATUS_TRANSITION");
  });
});

// ── POST /cancel-review ─────────────────────────────────────────────────────

describe("POST /api/projects/[id]/boq/cancel-review", () => {
  it("creator pulls a pending review back to draft", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
    });
    const cancelled: Boq = { ...baseBoq, status: "draft" };
    vi.mocked(cancelBoqReview).mockResolvedValue(cancelled);
    vi.mocked(getBoq).mockResolvedValue(fullBoqOf(cancelled));

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/cancel-review`, {
      method: "POST",
    });
    const res = await CANCEL(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqWithDetails>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("draft");
    expect(cancelBoqReview).toHaveBeenCalledWith(BOQ_ID);
  });

  it("rejects non-creator (403)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "pending_internal_review",
      created_by: OTHER_USER_ID,
    });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/cancel-review`, {
      method: "POST",
    });
    const res = await CANCEL(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
    expect(cancelBoqReview).not.toHaveBeenCalled();
  });

  it("rejects when status isn't pending_internal_review (422)", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue({
      ...baseBoq,
      status: "internally_approved",
    });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/cancel-review`, {
      method: "POST",
    });
    const res = await CANCEL(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(422);
    expect(body.code).toBe("INVALID_STATUS_TRANSITION");
  });
});
