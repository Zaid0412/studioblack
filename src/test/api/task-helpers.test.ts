import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { guardTaskAccess, guardTaskOwnership } from "@/app/api/tasks/helpers";
import { parseResponse } from "../helpers";

const { verifyTaskAccess, verifyTaskOwnership } = await import("@/lib/queries");

describe("guardTaskAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when orgId is null", async () => {
    const result = await guardTaskAccess({ id: "task-1" }, null);

    expect(result).toBeInstanceOf(NextResponse);
    const { status, body } = await parseResponse(result as Response);
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns 404 when verifyTaskAccess returns false", async () => {
    vi.mocked(verifyTaskAccess).mockResolvedValueOnce(false);

    const result = await guardTaskAccess({ id: "task-1" }, "org-1");

    expect(result).toBeInstanceOf(NextResponse);
    const { status } = await parseResponse(result as Response);
    expect(status).toBe(404);
  });

  it("returns taskId on success", async () => {
    vi.mocked(verifyTaskAccess).mockResolvedValueOnce(true);

    const result = await guardTaskAccess({ id: "task-1" }, "org-1");

    expect(result).toBe("task-1");
    expect(verifyTaskAccess).toHaveBeenCalledWith("task-1", "org-1");
  });
});

describe("guardTaskOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when task not owned by project", async () => {
    vi.mocked(verifyTaskOwnership).mockResolvedValueOnce(false);

    const result = await guardTaskOwnership("task-1", "proj-1");

    expect(result).toBeInstanceOf(NextResponse);
    const { status, body } = await parseResponse(result as Response);
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Task not found in this project" });
  });

  it("returns true on success", async () => {
    vi.mocked(verifyTaskOwnership).mockResolvedValueOnce(true);

    const result = await guardTaskOwnership("task-1", "proj-1");

    expect(result).toBe(true);
    expect(verifyTaskOwnership).toHaveBeenCalledWith("task-1", "proj-1");
  });
});
