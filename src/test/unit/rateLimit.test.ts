import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Must unmock since setup.ts mocks it ──────────────────────────────────────

vi.unmock("@/lib/rateLimit");

import { rateLimit } from "@/lib/rateLimit";

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("rateLimit", () => {
  it("allows first request", () => {
    const result = rateLimit("test-first", { limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each call", () => {
    const opts = { limit: 3, windowMs: 60_000 };

    const r1 = rateLimit("test-decrement", opts);
    const r2 = rateLimit("test-decrement", opts);
    const r3 = rateLimit("test-decrement", opts);

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it("blocks when limit is reached", () => {
    const opts = { limit: 2, windowMs: 60_000 };

    rateLimit("test-block", opts);
    rateLimit("test-block", opts);
    const r3 = rateLimit("test-block", opts);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("isolates keys from each other", () => {
    const opts = { limit: 1, windowMs: 60_000 };

    rateLimit("key-a", opts);
    const r = rateLimit("key-b", opts);

    expect(r.allowed).toBe(true);
  });

  it("allows requests after window expires", () => {
    const opts = { limit: 1, windowMs: 1000 };

    rateLimit("test-expire", opts);

    // Advance time past the window
    vi.useFakeTimers();
    vi.advanceTimersByTime(1001);

    const r = rateLimit("test-expire", opts);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);

    vi.useRealTimers();
  });

  it("returns limit of 1 with remaining 0 at exact limit", () => {
    const opts = { limit: 1, windowMs: 60_000 };

    const r = rateLimit("test-exact", opts);

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });
});
