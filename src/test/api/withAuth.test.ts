import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { auth } from "@/lib/auth";
import { hasProjectAccess, getOrgRole } from "@/lib/queries";
import { rateLimit } from "@/lib/rateLimit";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── Shared handler spy ──────────────────────────────────────────────────────

const handler = vi
  .fn()
  .mockImplementation(async (_req, ctx) =>
    NextResponse.json({ userId: ctx.user.id })
  );

// ── Reset mocks between tests ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  handler.mockImplementation(async (_req, ctx) =>
    NextResponse.json({ userId: ctx.user.id })
  );
});

// ── CSRF checks ─────────────────────────────────────────────────────────────

describe("CSRF checks", () => {
  const session = mockSession();

  beforeEach(() => {
    setupAuth(mocks.auth, session);
  });

  it("rejects POST with missing origin → 403", async () => {
    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    // Remove the auto-added origin header
    req.headers.delete("origin");

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(403);
    expect(body).toMatchObject({ error: "CSRF origin missing" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects POST with missing host → 403", async () => {
    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    req.headers.delete("host");

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(403);
    expect(body).toMatchObject({ error: "CSRF host missing" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects POST with origin/host mismatch → 403", async () => {
    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test", {
      method: "POST",
      headers: {
        origin: "http://evil.com",
        host: "localhost:3000",
      },
    });

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(403);
    expect(body).toMatchObject({ error: "CSRF origin mismatch" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes POST with valid origin/host", async () => {
    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test", { method: "POST" });

    const { status } = await parseResponse(await wrapped(req));

    expect(status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("skips CSRF check entirely for GET requests", async () => {
    const wrapped = withAuth({}, handler);
    // GET request with no origin or host — should still pass
    const req = buildRequest("/api/test", { method: "GET" });
    req.headers.delete("origin");
    req.headers.delete("host");

    const { status } = await parseResponse(await wrapped(req));

    expect(status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});

// ── Session checks ──────────────────────────────────────────────────────────

describe("Session checks", () => {
  it("returns 401 when no session exists", async () => {
    setupAuth(mocks.auth, null);

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes through with a valid session", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(200);
    expect(body).toMatchObject({ userId: session.user.id });
  });
});

// ── Role checks ─────────────────────────────────────────────────────────────

describe("Role checks", () => {
  describe("allowedRoles", () => {
    it("passes when user role is in allowedRoles", async () => {
      setupAuth(mocks.auth, mockSession({ role: "pm" }));

      const wrapped = withAuth({ allowedRoles: ["pm"] }, handler);
      const req = buildRequest("/api/test");

      const { status } = await parseResponse(await wrapped(req));

      expect(status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("returns 403 when user role is not in allowedRoles", async () => {
      setupAuth(mocks.auth, mockSession({ role: "architect" }));

      const wrapped = withAuth({ allowedRoles: ["pm"] }, handler);
      const req = buildRequest("/api/test");

      const { status, body } = await parseResponse(await wrapped(req));

      expect(status).toBe(403);
      expect(body).toMatchObject({ error: "Forbidden" });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("blockedRoles", () => {
    it("returns 403 when user role is in blockedRoles", async () => {
      setupAuth(mocks.auth, mockSession({ role: "client" }));

      const wrapped = withAuth({ blockedRoles: ["client"] }, handler);
      const req = buildRequest("/api/test");

      const { status, body } = await parseResponse(await wrapped(req));

      expect(status).toBe(403);
      expect(body).toMatchObject({ error: "Forbidden" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("passes when user role is not in blockedRoles", async () => {
      setupAuth(mocks.auth, mockSession({ role: "pm" }));

      const wrapped = withAuth({ blockedRoles: ["client"] }, handler);
      const req = buildRequest("/api/test");

      const { status } = await parseResponse(await wrapped(req));

      expect(status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });
});

// ── Project access ──────────────────────────────────────────────────────────

describe("Project access", () => {
  const session = mockSession();

  beforeEach(() => {
    setupAuth(mocks.auth, session);
  });

  it("passes when hasProjectAccess returns true", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const wrapped = withAuth({ projectAccess: true }, handler);
    const req = buildRequest("/api/projects/proj-1");
    const params = buildParams({ id: "proj-1" });

    const { status } = await parseResponse(await wrapped(req, params));

    expect(status).toBe(200);
    expect(hasProjectAccess).toHaveBeenCalledWith(
      "proj-1",
      session.user.id,
      session.user.email,
      session.user.role
    );
  });

  it("returns 403 when hasProjectAccess returns false", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const wrapped = withAuth({ projectAccess: true }, handler);
    const req = buildRequest("/api/projects/proj-1");
    const params = buildParams({ id: "proj-1" });

    const { status, body } = await parseResponse(await wrapped(req, params));

    expect(status).toBe(403);
    expect(body).toMatchObject({ error: "Forbidden" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 400 when projectAccess is true but no id param", async () => {
    const wrapped = withAuth({ projectAccess: true }, handler);
    const req = buildRequest("/api/projects");
    const params = buildParams({});

    const { status, body } = await parseResponse(await wrapped(req, params));

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Missing project ID" });
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Rate limiting ───────────────────────────────────────────────────────────

describe("Rate limiting", () => {
  const session = mockSession();

  beforeEach(() => {
    setupAuth(mocks.auth, session);
  });

  it("passes when rate limit allows", async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 5 });

    const wrapped = withAuth(
      { rateLimit: { limit: 10, windowMs: 60_000 } },
      handler
    );
    const req = buildRequest("/api/test");

    const { status } = await parseResponse(await wrapped(req));

    expect(status).toBe(200);
    expect(rateLimit).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0 });

    const wrapped = withAuth(
      { rateLimit: { limit: 10, windowMs: 60_000 } },
      handler
    );
    const req = buildRequest("/api/test");

    const { status, body } = await parseResponse(await wrapped(req));

    expect(status).toBe(429);
    expect(body).toMatchObject({
      error: "Too many requests. Please wait a moment.",
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Org resolution ──────────────────────────────────────────────────────────

describe("Org resolution", () => {
  it("uses activeOrganizationId from session when present", async () => {
    const session = mockSession({}, { activeOrganizationId: "org-active" });
    setupAuth(mocks.auth, session);

    handler.mockImplementation(async (_req, ctx) =>
      NextResponse.json({ orgId: ctx.orgId })
    );

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const { body } = await parseResponse(await wrapped(req));

    expect(body).toMatchObject({ orgId: "org-active" });
    expect(vi.mocked(auth.api.listOrganizations)).not.toHaveBeenCalled();
  });

  it("falls back to listOrganizations when no activeOrganizationId", async () => {
    const session = mockSession({}, { activeOrganizationId: null });
    setupAuth(mocks.auth, session);
    vi.mocked(auth.api.listOrganizations).mockResolvedValue([
      { id: "org-fallback", name: "Fallback Org" },
    ] as never);

    handler.mockImplementation(async (_req, ctx) =>
      NextResponse.json({ orgId: ctx.orgId })
    );

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const { body } = await parseResponse(await wrapped(req));

    expect(body).toMatchObject({ orgId: "org-fallback" });
    expect(vi.mocked(auth.api.listOrganizations)).toHaveBeenCalled();
  });

  it("sets orgId to null when no activeOrganizationId and no orgs found", async () => {
    const session = mockSession({}, { activeOrganizationId: null });
    setupAuth(mocks.auth, session);
    // setupAuth already sets listOrganizations to [] for null activeOrganizationId

    handler.mockImplementation(async (_req, ctx) =>
      NextResponse.json({ orgId: ctx.orgId })
    );

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const { body } = await parseResponse(await wrapped(req));

    expect(body).toMatchObject({ orgId: null });
  });
});

// ── fetchOrgRole ────────────────────────────────────────────────────────────

describe("fetchOrgRole", () => {
  it("calls getOrgRole and includes orgRole in context when fetchOrgRole is true", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue("admin");

    handler.mockImplementation(async (_req, ctx) =>
      NextResponse.json({ orgRole: ctx.orgRole })
    );

    const wrapped = withAuth({ fetchOrgRole: true }, handler);
    const req = buildRequest("/api/projects/proj-1");
    const params = buildParams({ id: "proj-1" });

    const { body } = await parseResponse(await wrapped(req, params));

    expect(body).toMatchObject({ orgRole: "admin" });
    expect(getOrgRole).toHaveBeenCalledWith("proj-1", session.user.id);
  });

  it("does not call getOrgRole when fetchOrgRole is false/unset", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    await wrapped(req);

    expect(getOrgRole).not.toHaveBeenCalled();
  });

  it("does not call getOrgRole when no id param is present", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const wrapped = withAuth({ fetchOrgRole: true }, handler);
    const req = buildRequest("/api/test");
    const params = buildParams({});

    await wrapped(req, params);

    expect(getOrgRole).not.toHaveBeenCalled();
  });
});

// ── Request ID ──────────────────────────────────────────────────────────────

describe("Request ID", () => {
  it("includes X-Request-Id header on successful responses", async () => {
    setupAuth(mocks.auth, mockSession());

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const res = await wrapped(req);

    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    // UUID v4 format
    expect(res.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("includes X-Request-Id header on error responses", async () => {
    setupAuth(mocks.auth, null);

    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test");

    const res = await wrapped(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("includes X-Request-Id on CSRF rejection", async () => {
    const wrapped = withAuth({}, handler);
    const req = buildRequest("/api/test", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    req.headers.delete("origin");

    const res = await wrapped(req);

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });
});
