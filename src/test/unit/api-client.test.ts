import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiBlob,
} from "@/lib/api/client";

// ── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.clearAllMocks());

// ── Helpers ──────────────────────────────────────────────────────────────────

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okEmpty(): Response {
  return new Response("", { status: 200 });
}

function errorJson(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorNoBody(status: number): Response {
  return new Response("not json", { status });
}

// ── ApiError ─────────────────────────────────────────────────────────────────

describe("ApiError", () => {
  it("sets status, message, and name", () => {
    const err = new ApiError(404, "Not found");

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
  });
});

// ── apiGet ───────────────────────────────────────────────────────────────────

describe("apiGet", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue(okJson({ id: 1, name: "Test" }));

    const result = await apiGet<{ id: number; name: string }>("/api/test");

    expect(result).toEqual({ id: 1, name: "Test" });
    expect(mockFetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("returns undefined for empty response body", async () => {
    mockFetch.mockResolvedValue(okEmpty());

    const result = await apiGet("/api/test");

    expect(result).toBeUndefined();
  });

  it("throws ApiError with error field on failure", async () => {
    mockFetch.mockResolvedValue(errorJson(403, { error: "Forbidden" }));

    const err = await apiGet("/api/test").catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("throws ApiError with message field on failure", async () => {
    mockFetch.mockResolvedValue(errorJson(400, { message: "Invalid input" }));

    await expect(apiGet("/api/test")).rejects.toMatchObject({
      status: 400,
      message: "Invalid input",
    });
  });

  it("throws ApiError with fallback message when body has no error/message", async () => {
    mockFetch.mockResolvedValue(errorJson(500, { detail: "something" }));

    await expect(apiGet("/api/test")).rejects.toMatchObject({
      status: 500,
      message: "Request failed (500)",
    });
  });

  it("throws ApiError with fallback when error body is unparseable", async () => {
    mockFetch.mockResolvedValue(errorNoBody(502));

    await expect(apiGet("/api/test")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502)",
    });
  });
});

// ── apiPost ──────────────────────────────────────────────────────────────────

describe("apiPost", () => {
  it("sends JSON body with Content-Type header", async () => {
    mockFetch.mockResolvedValue(okJson({ created: true }));

    const result = await apiPost("/api/items", { name: "New" });

    expect(result).toEqual({ created: true });
    expect(mockFetch).toHaveBeenCalledWith("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New" }),
    });
  });

  it("sends FormData without Content-Type header", async () => {
    mockFetch.mockResolvedValue(okJson({ uploaded: true }));
    const formData = new FormData();
    formData.append("file", "data");

    await apiPost("/api/upload", formData);

    expect(mockFetch).toHaveBeenCalledWith("/api/upload", {
      method: "POST",
      body: formData,
    });
  });

  it("sends POST with no body", async () => {
    mockFetch.mockResolvedValue(okJson({ ok: true }));

    await apiPost("/api/trigger");

    expect(mockFetch).toHaveBeenCalledWith("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
  });
});

// ── apiPatch ─────────────────────────────────────────────────────────────────

describe("apiPatch", () => {
  it("sends PATCH with JSON body", async () => {
    mockFetch.mockResolvedValue(okJson({ updated: true }));

    const result = await apiPatch("/api/items/1", { name: "Updated" });

    expect(result).toEqual({ updated: true });
    expect(mockFetch).toHaveBeenCalledWith("/api/items/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
  });
});

// ── apiDelete ────────────────────────────────────────────────────────────────

describe("apiDelete", () => {
  it("sends DELETE without body", async () => {
    mockFetch.mockResolvedValue(okEmpty());

    await apiDelete("/api/items/1");

    expect(mockFetch).toHaveBeenCalledWith("/api/items/1", {
      method: "DELETE",
    });
  });

  it("sends DELETE with JSON body", async () => {
    mockFetch.mockResolvedValue(okJson({ deleted: true }));

    const result = await apiDelete("/api/items", { ids: [1, 2] });

    expect(result).toEqual({ deleted: true });
    expect(mockFetch).toHaveBeenCalledWith("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [1, 2] }),
    });
  });
});

// ── apiBlob ──────────────────────────────────────────────────────────────────

describe("apiBlob", () => {
  it("returns blob on success", async () => {
    const blob = new Blob(["file content"], { type: "text/plain" });
    mockFetch.mockResolvedValue(new Response(blob, { status: 200 }));

    const result = await apiBlob("/api/files/1");

    expect(result).toBeInstanceOf(Blob);
    expect(await result.text()).toBe("file content");
  });

  it("throws ApiError on failure", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 404 }));

    await expect(apiBlob("/api/files/999")).rejects.toMatchObject({
      status: 404,
      message: "File download failed (404)",
    });
  });
});
