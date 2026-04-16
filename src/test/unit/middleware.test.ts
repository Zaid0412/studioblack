import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock: better-auth/cookies ────────────────────────────────────────────────

const mockGetSessionCookie = vi.fn();
vi.mock("better-auth/cookies", () => ({
  getSessionCookie: (...args: unknown[]) => mockGetSessionCookie(...args),
}));

import { middleware } from "@/middleware";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE = "http://localhost:3000";

function buildRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, BASE));
}

function getRedirectUrl(response: Response): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location);
  return url.pathname + url.search;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authenticated user ───────────────────────────────────────────────────

  describe("authenticated user", () => {
    beforeEach(() => {
      mockGetSessionCookie.mockReturnValue("session-token-value");
    });

    it("redirects from /login to /dashboard", async () => {
      const res = await middleware(buildRequest("/login"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/dashboard");
    });

    it("redirects from /register to /dashboard", async () => {
      const res = await middleware(buildRequest("/register"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/dashboard");
    });

    it("redirects from /forgot-password to /dashboard", async () => {
      const res = await middleware(buildRequest("/forgot-password"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/dashboard");
    });

    it("allows access to /dashboard", async () => {
      const res = await middleware(buildRequest("/dashboard"));
      expect(res.status).toBe(200);
    });

    it("allows access to /projects/123", async () => {
      const res = await middleware(buildRequest("/projects/123"));
      expect(res.status).toBe(200);
    });

    it("allows access to /reset-password", async () => {
      const res = await middleware(buildRequest("/reset-password"));
      expect(res.status).toBe(200);
    });

    it("allows access to /verify-email", async () => {
      const res = await middleware(buildRequest("/verify-email"));
      expect(res.status).toBe(200);
    });

    it("allows access to /verify-email-change", async () => {
      const res = await middleware(buildRequest("/verify-email-change"));
      expect(res.status).toBe(200);
    });
  });

  // ── Unauthenticated user ─────────────────────────────────────────────────

  describe("unauthenticated user", () => {
    beforeEach(() => {
      mockGetSessionCookie.mockReturnValue(null);
    });

    it("redirects from /dashboard to /login with returnTo", async () => {
      const res = await middleware(buildRequest("/dashboard"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/login?returnTo=%2Fdashboard");
    });

    it("redirects from /projects/123 to /login with returnTo", async () => {
      const res = await middleware(buildRequest("/projects/123"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/login?returnTo=%2Fprojects%2F123");
    });

    it("redirects from / to /login without returnTo", async () => {
      const res = await middleware(buildRequest("/"));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe("/login");
    });

    it("preserves query string in returnTo", async () => {
      const res = await middleware(
        buildRequest("/dashboard?tab=settings&id=1")
      );
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe(
        "/login?returnTo=%2Fdashboard%3Ftab%3Dsettings%26id%3D1"
      );
    });

    it("allows access to /reset-password", async () => {
      const res = await middleware(buildRequest("/reset-password"));
      expect(res.status).toBe(200);
    });

    it("allows access to /verify-email", async () => {
      const res = await middleware(buildRequest("/verify-email"));
      expect(res.status).toBe(200);
    });

    it("allows access to /verify-email-change", async () => {
      const res = await middleware(buildRequest("/verify-email-change"));
      expect(res.status).toBe(200);
    });
  });
});
