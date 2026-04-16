import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock handles (hoisted so vi.mock factories can reference them) ──────────

const { mockApiGet, mockToast, MockApiError } = vi.hoisted(() => {
  const mockApiGet = vi.fn();
  const mockToast = vi.fn();

  class MockApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return { mockApiGet, mockToast, MockApiError };
});

vi.mock("@/lib/api/client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  ApiError: MockApiError,
}));

vi.mock("@/components/ui/useToast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

import { swrFetcher, swrConfig } from "@/lib/swr";
import { ApiError } from "@/lib/api/client";

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

// ── swrFetcher ──────────────────────────────────────────────────────────────

describe("swrFetcher", () => {
  it("delegates to apiGet with the URL", async () => {
    mockApiGet.mockResolvedValue({ data: "ok" });

    const result = await swrFetcher("/api/test");

    expect(mockApiGet).toHaveBeenCalledWith("/api/test");
    expect(result).toEqual({ data: "ok" });
  });

  it("propagates errors from apiGet", async () => {
    mockApiGet.mockRejectedValue(new Error("network failure"));

    await expect(swrFetcher("/api/fail")).rejects.toThrow("network failure");
  });
});

// ── swrConfig.onError ───────────────────────────────────────────────────────

describe("swrConfig.onError", () => {
  const onError = swrConfig.onError!;

  it("suppresses 401 ApiError (no toast)", () => {
    const err = new ApiError("Unauthorized", 401);

    onError(err, "/api/test", swrConfig);

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("shows toast for non-401 ApiError", () => {
    const err = new ApiError("Not found", 404);

    onError(err, "/api/test", swrConfig);

    expect(mockToast).toHaveBeenCalledWith({
      title: "Error",
      description: "Not found",
      variant: "error",
    });
  });

  it("shows fallback message for non-Error objects", () => {
    onError("something weird" as unknown, "/api/test", swrConfig);

    expect(mockToast).toHaveBeenCalledWith({
      title: "Error",
      description: "Failed to load data",
      variant: "error",
    });
  });
});

// ── swrConfig defaults ──────────────────────────────────────────────────────

describe("swrConfig defaults", () => {
  it("has expected defaults", () => {
    expect(swrConfig.revalidateOnFocus).toBe(true);
    expect(swrConfig.dedupingInterval).toBe(5000);
    expect(swrConfig.errorRetryCount).toBe(3);
  });
});
