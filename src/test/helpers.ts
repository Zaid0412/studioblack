/**
 * Test factories and utilities for building mock requests and sessions.
 */
import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { ElementCategory } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
}

export interface MockSession {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    activeOrganizationId: string | null;
  };
  user: MockUser;
}

// ── Factories ────────────────────────────────────────────────────────────────

const TEST_ORG_ID = "org-test-001";
const TEST_USER_ID = "user-test-001";

/** Create a mock user with sensible defaults. */
export function mockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: TEST_USER_ID,
    email: "pm@test.com",
    name: "Test PM",
    role: "pm",
    image: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    emailVerified: true,
    ...overrides,
  };
}

/** Create a mock session wrapping a user. */
export function mockSession(
  userOverrides: Partial<MockUser> = {},
  sessionOverrides: Partial<MockSession["session"]> = {}
): MockSession {
  const user = mockUser(userOverrides);
  return {
    session: {
      id: "session-test-001",
      userId: user.id,
      token: "test-token",
      expiresAt: new Date(Date.now() + 86400_000),
      activeOrganizationId: TEST_ORG_ID,
      ...sessionOverrides,
    },
    user,
  };
}

// ── Request builders ─────────────────────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}

const BASE_URL = "http://localhost:3000";

/**
 * Build a NextRequest for testing route handlers.
 * Automatically adds origin + host headers for CSRF on mutating methods.
 */
export function buildRequest(
  path: string,
  options: RequestOptions = {}
): NextRequest {
  const { method = "GET", body, searchParams, headers: extraHeaders } = options;

  const url = new URL(path, BASE_URL);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extraHeaders,
  };

  // Add CSRF headers for mutating methods
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    headers.origin ??= BASE_URL;
    headers.host ??= "localhost:3000";
  }

  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Build route params matching Next.js App Router pattern. */
export function buildParams(params: Record<string, string>): {
  params: Promise<Record<string, string>>;
} {
  return { params: Promise.resolve(params) };
}

// ── Auth setup helper ────────────────────────────────────────────────────────

/**
 * Configure the auth mock for a test. Sets up getSession and listOrganizations.
 * Import `mocks` from setup.ts to use this.
 */
export function setupAuth(
  authMocks: {
    getSession: ReturnType<typeof vi.fn>;
    listOrganizations: ReturnType<typeof vi.fn>;
    listMembers: ReturnType<typeof vi.fn>;
  },
  session: MockSession | null
) {
  authMocks.getSession.mockResolvedValue(session);
  if (session?.session.activeOrganizationId) {
    authMocks.listOrganizations.mockResolvedValue([
      { id: session.session.activeOrganizationId, name: "Test Org" },
    ]);
  } else {
    authMocks.listOrganizations.mockResolvedValue([]);
  }
}

// ── Response helpers ─────────────────────────────────────────────────────────

/** Extract JSON body and status from a NextResponse. */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; body: T }> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

// ── FormData helpers ─────────────────────────────────────────────────────────

/** Build a NextRequest with FormData body + CSRF headers. */
export function buildFormDataRequest(
  path: string,
  formData: FormData
): NextRequest {
  return new NextRequest(new URL(path, BASE_URL), {
    method: "POST",
    headers: { origin: BASE_URL, host: "localhost:3000" },
    body: formData,
  });
}

/** Create a File for FormData testing. */
export function createTestFile(
  name: string,
  type: string,
  sizeBytes: number = 100
): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

// ── Element categories ──────────────────────────────────────────────────────

/** Build one `element_category` row. `level` 1/2/3 = Category / Sub / Service Area. */
export function mockCategory(
  overrides: Partial<ElementCategory> & {
    id: string;
    name: string;
    level: 1 | 2 | 3;
  }
): ElementCategory {
  return {
    org_id: TEST_ORG_ID,
    parent_id: null,
    code_prefix: null,
    sort_order: 0,
    icon: null,
    color: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * A full Category → Sub-category → Service Area chain. Elements must sit under
 * a Service Area, so almost every element fixture needs one of these — sharing
 * it keeps the four suites that import elements from each inventing their own.
 */
export const SERVICE_AREA_CHAIN: ElementCategory[] = [
  mockCategory({ id: "cat-f", name: "Finishes", level: 1, code_prefix: "FIN" }),
  mockCategory({
    id: "cat-wf",
    name: "Wall Finishes",
    parent_id: "cat-f",
    level: 2,
    code_prefix: "FIN-WAL",
  }),
  mockCategory({
    id: "cat-pt",
    name: "Paint",
    parent_id: "cat-wf",
    level: 3,
    code_prefix: "FIN-WAL-PNT",
  }),
];

/** The `Category Path` cell value that resolves to SERVICE_AREA_CHAIN's leaf. */
export const SERVICE_AREA_PATH = ["Finishes", "Wall Finishes", "Paint"];

// ── Async helpers ───────────────────────────────────────────────────────────

/** Flush microtask queue so fire-and-forget promise chains resolve. */
export const flushPromises = () => new Promise((r) => setImmediate(r));

// ── Constants ────────────────────────────────────────────────────────────────

export { BASE_URL, TEST_ORG_ID, TEST_USER_ID };
