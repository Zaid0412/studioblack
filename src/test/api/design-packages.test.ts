import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDesignPackages, getDesignDisciplines } from "@/lib/queries";
import { GET as GET_PACKAGES } from "@/app/api/projects/[id]/design-packages/route";
import { GET as GET_DISCIPLINES } from "@/app/api/design-disciplines/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { DesignDiscipline, DesignPackage } from "@/types";

const PROJECT_ID = "proj-1";

const samplePackage: DesignPackage = {
  id: "pkg-1",
  project_id: PROJECT_ID,
  org_id: "org-test-001",
  code: "CON",
  name: "Concept Design",
  sort_order: 0,
  status: "draft",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const sampleDiscipline: DesignDiscipline = {
  id: "dis-1",
  org_id: "org-test-001",
  code: "AR",
  name: "Architecture",
  sort_order: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, mockSession());
});

describe("GET /api/projects/[id]/design-packages", () => {
  it("returns the project's packages", async () => {
    vi.mocked(getDesignPackages).mockResolvedValue([samplePackage]);

    const res = await GET_PACKAGES(
      buildRequest(`/api/projects/${PROJECT_ID}/design-packages`),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{ packages: DesignPackage[] }>(
      res
    );

    expect(status).toBe(200);
    expect(body.packages).toEqual([samplePackage]);
    expect(getDesignPackages).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("returns 401 without a session", async () => {
    setupAuth(mocks.auth, null);
    const res = await GET_PACKAGES(
      buildRequest(`/api/projects/${PROJECT_ID}/design-packages`),
      buildParams({ id: PROJECT_ID })
    );
    expect((await parseResponse(res)).status).toBe(401);
  });
});

describe("GET /api/design-disciplines", () => {
  it("returns the org's disciplines", async () => {
    vi.mocked(getDesignDisciplines).mockResolvedValue([sampleDiscipline]);

    const res = await GET_DISCIPLINES(buildRequest("/api/design-disciplines"));
    const { status, body } = await parseResponse<{
      disciplines: DesignDiscipline[];
    }>(res);

    expect(status).toBe(200);
    expect(body.disciplines).toEqual([sampleDiscipline]);
  });

  it("forbids clients (staff-only reference data)", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await GET_DISCIPLINES(buildRequest("/api/design-disciplines"));
    expect((await parseResponse(res)).status).toBe(403);
  });
});
