import { describe, it, expect, vi, beforeEach } from "vitest";
import * as attachments from "@/lib/api/attachments";
import * as tasks from "@/lib/api/tasks";

// ── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.clearAllMocks());

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── attachments.list ─────────────────────────────────────────────────────────

describe("attachments.list", () => {
  it("calls bare URL with no options", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.list("proj-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments",
      undefined
    );
  });

  it("appends phaseId query param", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.list("proj-1", { phaseId: "phase-1" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments?phaseId=phase-1",
      undefined
    );
  });

  it("appends all=true query param", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.list("proj-1", { all: true });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/attachments?all=true",
      undefined
    );
  });

  it("appends both phaseId and all params", async () => {
    mockFetch.mockResolvedValue(okJson([]));

    await attachments.list("proj-1", { phaseId: "phase-1", all: true });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("phaseId=phase-1");
    expect(url).toContain("all=true");
  });
});

// ── tasks.list ───────────────────────────────────────────────────────────────

describe("tasks.list", () => {
  it("calls bare URL with no params", async () => {
    mockFetch.mockResolvedValue(okJson({ tasks: [], counts: {}, total: 0 }));

    await tasks.list();

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", undefined);
  });

  it("appends query string from params", async () => {
    mockFetch.mockResolvedValue(okJson({ tasks: [], counts: {}, total: 0 }));

    await tasks.list({ status: "todo", projectId: "proj-1" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=todo");
    expect(url).toContain("projectId=proj-1");
  });
});
