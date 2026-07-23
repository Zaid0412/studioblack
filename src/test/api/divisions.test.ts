import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDivisions,
  createDivision,
  updateDivision,
  deleteDivision,
  getDivisionUsage,
  reorderDivisions,
  seedDefaultDivisions,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/divisions/route";
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/divisions/[id]/route";
import { GET as GET_USAGE } from "@/app/api/divisions/[id]/usage/route";
import { PATCH as PATCH_REORDER } from "@/app/api/divisions/reorder/route";
import { POST as POST_RESTORE } from "@/app/api/divisions/restore/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { Division, DivisionUsage } from "@/types";

const DIV_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const DIV_ID_2 = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const fakeDivision: Division = {
  id: DIV_ID,
  org_id: "org-test-001",
  code: "CIV",
  name: "Civil Works",
  sort_order: 0,
  enabled: true,
  is_default: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

describe("GET /api/divisions", () => {
  it("returns the org's divisions", async () => {
    vi.mocked(getDivisions).mockResolvedValue([fakeDivision]);

    const res = await GET(buildRequest("/api/divisions"));
    const { status, body } = await parseResponse<{ divisions: Division[] }>(
      res
    );

    expect(status).toBe(200);
    expect(body.divisions).toHaveLength(1);
    expect(body.divisions[0].code).toBe("CIV");
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET(buildRequest("/api/divisions"));
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });
});

describe("POST /api/divisions", () => {
  it("creates a division", async () => {
    vi.mocked(createDivision).mockResolvedValue(fakeDivision);

    const res = await POST(
      buildRequest("/api/divisions", {
        method: "POST",
        body: { code: "CIV", name: "Civil Works" },
      })
    );
    const { status, body } = await parseResponse<Division>(res);

    expect(status).toBe(201);
    expect(body.code).toBe("CIV");
  });

  it("returns 400 on a duplicate code", async () => {
    vi.mocked(createDivision).mockRejectedValue(
      new Error("A division with this code already exists")
    );

    const res = await POST(
      buildRequest("/api/divisions", {
        method: "POST",
        body: { code: "CIV", name: "Civil Works" },
      })
    );
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("already exists");
  });

  it("returns 400 when code is empty", async () => {
    const res = await POST(
      buildRequest("/api/divisions", {
        method: "POST",
        body: { code: "", name: "Civil Works" },
      })
    );
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("allows architect role", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(createDivision).mockResolvedValue(fakeDivision);

    const res = await POST(
      buildRequest("/api/divisions", {
        method: "POST",
        body: { code: "CIV", name: "Civil Works" },
      })
    );
    expect((await parseResponse(res)).status).toBe(201);
  });
});

describe("PATCH /api/divisions/[id]", () => {
  it("updates a division", async () => {
    vi.mocked(updateDivision).mockResolvedValue({
      ...fakeDivision,
      enabled: false,
    });

    const res = await PATCH_ITEM(
      buildRequest(`/api/divisions/${DIV_ID}`, {
        method: "PATCH",
        body: { enabled: false },
      }),
      buildParams({ id: DIV_ID })
    );
    const { status, body } = await parseResponse<Division>(res);

    expect(status).toBe(200);
    expect(body.enabled).toBe(false);
    // The route maps camelCase isDefault → snake_case is_default for the query.
    expect(vi.mocked(updateDivision).mock.calls[0][2]).toHaveProperty(
      "enabled"
    );
  });

  it("returns 404 when the division doesn't exist", async () => {
    vi.mocked(updateDivision).mockResolvedValue(null);

    const res = await PATCH_ITEM(
      buildRequest(`/api/divisions/${DIV_ID}`, {
        method: "PATCH",
        body: { name: "X" },
      }),
      buildParams({ id: DIV_ID })
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("DELETE /api/divisions/[id]", () => {
  it("deletes a division", async () => {
    vi.mocked(deleteDivision).mockResolvedValue({ deleted: true });

    const res = await DELETE_ITEM(
      buildRequest(`/api/divisions/${DIV_ID}`, { method: "DELETE" }),
      buildParams({ id: DIV_ID })
    );
    expect((await parseResponse(res)).status).toBe(200);
  });

  it("returns 409 when the division is still in use", async () => {
    vi.mocked(deleteDivision).mockResolvedValue({
      deleted: false,
      error: "Division is in use by a BOQ. Disable it instead.",
    });

    const res = await DELETE_ITEM(
      buildRequest(`/api/divisions/${DIV_ID}`, { method: "DELETE" }),
      buildParams({ id: DIV_ID })
    );
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toContain("in use");
  });

  it("returns 404 when not found", async () => {
    vi.mocked(deleteDivision).mockResolvedValue({
      deleted: false,
      error: "Division not found",
    });

    const res = await DELETE_ITEM(
      buildRequest(`/api/divisions/${DIV_ID}`, { method: "DELETE" }),
      buildParams({ id: DIV_ID })
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("GET /api/divisions/[id]/usage", () => {
  it("returns the projects (with counts) that reference the division", async () => {
    vi.mocked(getDivisionUsage).mockResolvedValue([
      {
        project_id: "p1",
        project_name: "Riverside Tower",
        item_count: 0,
        section_count: 1,
      },
    ]);

    const res = await GET_USAGE(
      buildRequest(`/api/divisions/${DIV_ID}/usage`),
      buildParams({ id: DIV_ID })
    );
    const { status, body } = await parseResponse<{ usage: DivisionUsage[] }>(
      res
    );

    expect(status).toBe(200);
    expect(body.usage).toHaveLength(1);
    expect(body.usage[0].project_name).toBe("Riverside Tower");
    expect(body.usage[0].section_count).toBe(1);
  });

  it("returns an empty list for an unreferenced division", async () => {
    vi.mocked(getDivisionUsage).mockResolvedValue([]);

    const res = await GET_USAGE(
      buildRequest(`/api/divisions/${DIV_ID}/usage`),
      buildParams({ id: DIV_ID })
    );
    const { status, body } = await parseResponse<{ usage: DivisionUsage[] }>(
      res
    );

    expect(status).toBe(200);
    expect(body.usage).toHaveLength(0);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_USAGE(
      buildRequest(`/api/divisions/${DIV_ID}/usage`),
      buildParams({ id: DIV_ID })
    );
    expect((await parseResponse(res)).status).toBe(403);
  });
});

describe("PATCH /api/divisions/reorder", () => {
  it("reorders divisions", async () => {
    vi.mocked(reorderDivisions).mockResolvedValue(undefined);

    const res = await PATCH_REORDER(
      buildRequest("/api/divisions/reorder", {
        method: "PATCH",
        body: { orderedIds: [DIV_ID_2, DIV_ID] },
      })
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(vi.mocked(reorderDivisions)).toHaveBeenCalledWith("org-test-001", [
      DIV_ID_2,
      DIV_ID,
    ]);
  });
});

describe("POST /api/divisions/restore", () => {
  it("re-seeds defaults and returns the updated list", async () => {
    vi.mocked(seedDefaultDivisions).mockResolvedValue(3);
    vi.mocked(getDivisions).mockResolvedValue([fakeDivision]);

    const res = await POST_RESTORE(
      buildRequest("/api/divisions/restore", { method: "POST" })
    );
    const { status, body } = await parseResponse<{
      added: number;
      divisions: Division[];
    }>(res);

    expect(status).toBe(200);
    expect(body.added).toBe(3);
    expect(body.divisions).toHaveLength(1);
  });
});
