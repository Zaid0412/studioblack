import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAttachmentPhaseCounts,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { GET } from "@/app/api/projects/[id]/attachments/phase-counts/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "proj-1";
const URL_ = `/api/projects/${PROJECT_ID}/attachments/phase-counts`;
const SAMPLE_COUNTS = [
  { phase_id: "phase-1", count: 3 },
  { phase_id: "phase-2", count: 1 },
];

/** Fire the phase-counts GET for the fixture project. */
const call = () => GET(buildRequest(URL_), buildParams({ id: PROJECT_ID }));

describe("GET /api/projects/[id]/attachments/phase-counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const { status } = await parseResponse(await call());

    expect(status).toBe(401);
  });

  it("returns per-phase counts (team member sees all files)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getAttachmentPhaseCounts).mockResolvedValue(SAMPLE_COUNTS);

    const { status, body } = await parseResponse(await call());

    expect(status).toBe(200);
    expect(body).toEqual(SAMPLE_COUNTS);
    // Team member (non-client) → clientOnly must be false.
    expect(getAttachmentPhaseCounts).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      clientOnly: false,
    });
  });

  it("scopes counts to client-visible files for a client", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(true);
    vi.mocked(getAttachmentPhaseCounts).mockResolvedValue([
      { phase_id: "phase-1", count: 1 },
    ]);

    const { status } = await parseResponse(await call());

    expect(status).toBe(200);
    // Client → clientOnly true so only files sent to the client are counted.
    expect(getAttachmentPhaseCounts).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      clientOnly: true,
    });
  });

  it("enforces project access (403 when not a member)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const { status } = await parseResponse(await call());

    expect(status).toBe(403);
    expect(getAttachmentPhaseCounts).not.toHaveBeenCalled();
  });
});

// ── Query-level: SQL shape (latest-version + clientOnly gating) ──────────────

async function realGetAttachmentPhaseCounts(filters: {
  projectId: string;
  clientOnly?: boolean;
}) {
  const actual = await vi.importActual<
    typeof import("@/lib/queries/attachments")
  >("@/lib/queries/attachments");
  return actual.getAttachmentPhaseCounts(filters);
}

describe("getAttachmentPhaseCounts (query)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts the latest version per group, grouped by phase", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: SAMPLE_COUNTS });

    const result = await realGetAttachmentPhaseCounts({
      projectId: PROJECT_ID,
    });

    expect(result).toEqual(SAMPLE_COUNTS);
    const [sql, params] = mocks.db.query.mock.calls[0]!;
    expect(String(sql)).toContain("DISTINCT ON (a.version_group)");
    expect(String(sql)).toContain("GROUP BY phase_id");
    // No client gating for a team query.
    expect(String(sql)).not.toContain("sent_to_client_at");
    expect(params).toEqual([PROJECT_ID]);
  });

  it("gates on sent_to_client_at when clientOnly", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });

    await realGetAttachmentPhaseCounts({
      projectId: PROJECT_ID,
      clientOnly: true,
    });

    const [sql] = mocks.db.query.mock.calls[0]!;
    expect(String(sql)).toContain("sent_to_client_at IS NOT NULL");
  });
});
