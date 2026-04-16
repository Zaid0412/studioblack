import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { findAttachmentOrFail } from "@/app/api/projects/[id]/attachments/helpers";
import { parseResponse } from "../helpers";

const { getAttachmentById } = await import("@/lib/queries");

describe("findAttachmentOrFail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when attachment not found", async () => {
    vi.mocked(getAttachmentById).mockResolvedValueOnce(null);

    const result = await findAttachmentOrFail("att-1", "proj-1");

    expect(result).toBeInstanceOf(NextResponse);
    const { status, body } = await parseResponse(result as Response);
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns attachment on success", async () => {
    const attachment = {
      id: "att-1",
      file_name: "plan.pdf",
      project_id: "proj-1",
    };
    vi.mocked(getAttachmentById).mockResolvedValueOnce(attachment);

    const result = await findAttachmentOrFail("att-1", "proj-1");

    expect(result).toEqual(attachment);
    expect(getAttachmentById).toHaveBeenCalledWith("att-1", "proj-1");
  });
});
