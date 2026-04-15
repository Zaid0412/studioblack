import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/proxy-file/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const VALID_URL =
  "https://test.supabase.co/storage/v1/object/public/files/test.pdf";

// ── GET /api/proxy-file ─────────────────────────────────────────────────────

describe("GET /api/proxy-file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: VALID_URL },
    });
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 when url parameter is missing", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/proxy-file");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Missing url parameter" });
  });

  it("returns 400 for invalid URL", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: "not-a-url" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid URL" });
  });

  it("returns 400 for non-HTTPS URL", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: "http://test.supabase.co/storage/v1/file.pdf" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Only HTTPS URLs are allowed" });
  });

  it("returns 400 for URL with wrong host", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: "https://evil.example.com/file.pdf" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid URL" });
  });

  it("proxies file from valid Supabase URL", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const fileContent = new Uint8Array([1, 2, 3, 4]);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(fileContent, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": "4",
        },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: VALID_URL },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");

    vi.unstubAllGlobals();
  });

  it("returns upstream error status when fetch fails", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: VALID_URL },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Failed to fetch file" });

    vi.unstubAllGlobals();
  });

  it("returns 413 when content-length exceeds limit", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response("", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(51 * 1024 * 1024), // 51 MB
        },
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = buildRequest("/api/proxy-file", {
      searchParams: { url: VALID_URL },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(413);
    expect(body).toMatchObject({ error: "File too large" });

    vi.unstubAllGlobals();
  });
});
