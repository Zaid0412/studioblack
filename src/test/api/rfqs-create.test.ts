/**
 * POST /api/projects/[id]/rfqs — create a draft RFQ + items.
 *
 * Pins:
 *   - PM/architect create; client + vendor blocked.
 *   - Items array is required (Zod min(1)).
 *   - The query layer's "not belong to this project" error becomes 400.
 *   - Audit row written on success.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  createRfqDraft,
  hasProjectAccess,
  logAuditSafe,
} from "@/lib/queries";
import { POST as POST_RFQ } from "@/app/api/projects/[id]/rfqs/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { Rfq } from "@/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BOQ_ITEM_ID = "22222222-2222-4222-8222-222222222222";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const sampleRfq: Rfq = {
  id: "33333333-3333-4333-8333-333333333333",
  org_id: "org-test-001",
  project_id: PROJECT_ID,
  rfq_number: "RFQ-2026-001",
  title: "Plumbing scope",
  status: "draft",
  issued_date: null,
  response_deadline: null,
  award_date: null,
  awarded_vendor_id: null,
  scope_of_work: null,
  terms_conditions: null,
  attachments: null,
  created_by: "user-test-001",
  created_at: "2026-05-14T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
};

const validBody = {
  title: "Plumbing scope",
  items: [
    {
      boqItemId: BOQ_ITEM_ID,
      description: "Copper pipe",
      unit: "m",
      quantity: 100,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(createRfqDraft).mockResolvedValue(sampleRfq);
});

describe("POST /api/projects/[id]/rfqs", () => {
  it("creates an RFQ for PM with valid body", async () => {
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<Rfq>(res);
    expect(status).toBe(201);
    expect(body.rfq_number).toBe("RFQ-2026-001");
  });

  it("logs an audit event on success", async () => {
    await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(vi.mocked(logAuditSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RFQ_CREATED,
        targetTable: "rfq",
        targetId: sampleRfq.id,
        metadata: expect.objectContaining({
          rfq_number: "RFQ-2026-001",
          item_count: 1,
        }),
      })
    );
  });

  it("400 when items array is empty", async () => {
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: { title: "X", items: [] },
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400 when title is missing", async () => {
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: { items: validBody.items },
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400 when a BOQ item does not belong to the project", async () => {
    vi.mocked(createRfqDraft).mockRejectedValue(
      new Error("One or more BOQ items do not belong to this project")
    );
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(400);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("403 when project access denied", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);
    const res = await POST_RFQ(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        method: "POST",
        body: validBody,
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });
});
