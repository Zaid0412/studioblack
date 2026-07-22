import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  bulkCreateCategoriesFromTemplates,
  findShortCodeSegment,
} from "@/lib/queries";
import { POST } from "@/app/api/element-categories/bulk/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { ElementCategory } from "@/types";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });

const threeLevelPayload = {
  categories: [
    {
      name: "Kitchen",
      codePrefix: "KIT",
      icon: "ChefHat",
      color: "#f59e0b",
      children: [
        {
          name: "Cabinets",
          codePrefix: "KIT-CAB",
          children: [
            { name: "Base Cabinets", codePrefix: "KIT-CAB-BASE" },
            { name: "Wall Cabinets", codePrefix: "KIT-CAB-WALL" },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

describe("POST /api/element-categories/bulk", () => {
  it("accepts a 3-level taxonomy payload and returns 201", async () => {
    vi.mocked(bulkCreateCategoriesFromTemplates).mockResolvedValue({
      created: [{}, {}, {}] as unknown as ElementCategory[],
      skipped: [],
    });

    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: threeLevelPayload,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ created: unknown[] }>(res);

    expect(status).toBe(201);
    expect(body.created).toHaveLength(3);
    expect(bulkCreateCategoriesFromTemplates).toHaveBeenCalledWith(
      "org-test-001",
      threeLevelPayload.categories
    );
  });

  it("works for architect role", async () => {
    setupAuth(mocks.auth, architectSession);
    vi.mocked(bulkCreateCategoriesFromTemplates).mockResolvedValue({
      created: [],
      skipped: [],
    });

    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: threeLevelPayload,
    });
    const res = await POST(req);
    expect((await parseResponse(res)).status).toBe(201);
  });

  it("rejects an empty categories array", async () => {
    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: { categories: [] },
    });
    const res = await POST(req);
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("rejects a node name over 150 chars", async () => {
    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: { categories: [{ name: "x".repeat(151) }] },
    });
    const res = await POST(req);
    expect((await parseResponse(res)).status).toBe(400);
  });

  it("rejects a too-short code segment with 400 before creating", async () => {
    vi.mocked(findShortCodeSegment).mockReturnValue("PLB-FIX-K");

    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: threeLevelPayload,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("too short");
    expect(bulkCreateCategoriesFromTemplates).not.toHaveBeenCalled();
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const req = buildRequest("/api/element-categories/bulk", {
      method: "POST",
      body: { categories: [{ name: "Kitchen" }] },
    });
    const res = await POST(req);
    expect((await parseResponse(res)).status).toBe(403);
  });
});
