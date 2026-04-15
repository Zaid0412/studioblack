import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { getPool } from "@/lib/db";
import { parseResponse } from "../helpers";

describe("GET /api/health", () => {
  it("returns ok when DB is reachable", async () => {
    vi.mocked(getPool).mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    } as never);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "ok" });
    expect(body).toHaveProperty("ts");
  });

  it("returns 503 when DB is unreachable", async () => {
    vi.mocked(getPool).mockReturnValue({
      query: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as never);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body).toMatchObject({ status: "error", db: "unreachable" });
  });
});
