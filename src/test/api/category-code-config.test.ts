import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCategoryCodeConfig, upsertCategoryCodeConfig } from "@/lib/queries";
import { GET, PATCH } from "@/app/api/category-code-config/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { CategoryCodeConfig } from "@/types";

const DEFAULTS: CategoryCodeConfig = {
  auto_generate: true,
  code_max_length: 4,
  force_uppercase: true,
  prevent_duplicates: true,
  lock_after_use: true,
};

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

describe("GET /api/category-code-config", () => {
  it("returns the org's config", async () => {
    vi.mocked(getCategoryCodeConfig).mockResolvedValue(DEFAULTS);
    const res = await GET(buildRequest("/api/category-code-config"));
    const { status, body } = await parseResponse<{
      config: CategoryCodeConfig;
    }>(res);
    expect(status).toBe(200);
    expect(body.config.code_max_length).toBe(4);
  });

  it("allows architect role", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(getCategoryCodeConfig).mockResolvedValue(DEFAULTS);
    const res = await GET(buildRequest("/api/category-code-config"));
    expect((await parseResponse(res)).status).toBe(200);
  });
});

describe("PATCH /api/category-code-config", () => {
  it("updates the config (PM)", async () => {
    vi.mocked(upsertCategoryCodeConfig).mockResolvedValue({
      ...DEFAULTS,
      auto_generate: false,
      code_max_length: 5,
    });
    const res = await PATCH(
      buildRequest("/api/category-code-config", {
        method: "PATCH",
        body: { autoGenerate: false, codeMaxLength: 5 },
      })
    );
    const { status, body } = await parseResponse<{
      config: CategoryCodeConfig;
    }>(res);
    expect(status).toBe(200);
    expect(body.config.code_max_length).toBe(5);
    // Route maps camelCase → snake_case for the query.
    expect(vi.mocked(upsertCategoryCodeConfig).mock.calls[0][1]).toMatchObject({
      auto_generate: false,
      code_max_length: 5,
    });
  });

  it("rejects a max length outside 3/4/5", async () => {
    const res = await PATCH(
      buildRequest("/api/category-code-config", {
        method: "PATCH",
        body: { codeMaxLength: 8 },
      })
    );
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("allows architect (staff) to write", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(upsertCategoryCodeConfig).mockResolvedValue(DEFAULTS);
    const res = await PATCH(
      buildRequest("/api/category-code-config", {
        method: "PATCH",
        body: { autoGenerate: false },
      })
    );
    expect((await parseResponse(res)).status).toBe(200);
  });

  it("returns 403 for client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await PATCH(
      buildRequest("/api/category-code-config", {
        method: "PATCH",
        body: { autoGenerate: false },
      })
    );
    expect((await parseResponse(res)).status).toBe(403);
  });
});
