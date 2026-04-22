/**
 * Global test setup — mocks all external boundaries so route handlers
 * can be tested in isolation without a real database, auth, or email.
 */
import { vi } from "vitest";

// ── Environment variables (must be set before any module reads them) ─────────

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
// NODE_ENV is set to "test" via vitest.config.ts — don't assign here
// because Next.js marks it read-only during builds.
process.env.LOG_LEVEL = "error"; // suppress noise during tests

// ── Mock: next/headers ──────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// ── Mock: @/lib/db ──────────────────────────────────────────────────────────

const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: vi.fn(),
});

vi.mock("@/lib/db", () => ({
  getPool: vi.fn(() => ({
    query: mockQuery,
    connect: mockConnect,
  })),
}));

// ── Mock: @/lib/auth ────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockListOrganizations = vi.fn().mockResolvedValue([]);
const mockListMembers = vi.fn().mockResolvedValue({ members: [] });
const mockSetActiveOrganization = vi.fn();
const mockSignInMagicLink = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
      listOrganizations: mockListOrganizations,
      listMembers: mockListMembers,
      setActiveOrganization: mockSetActiveOrganization,
      signInMagicLink: mockSignInMagicLink,
    },
  },
}));

// ── Mock: @/lib/email ───────────────────────────────────────────────────────

vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: vi.fn(),
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendInvitationEmail: vi.fn(),
  sendChangeEmailVerification: vi.fn(),
  escapeHtml: vi.fn((s: string) => s),
}));

// ── Mock: @/lib/notifications ───────────────────────────────────────────────

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationsForTeam: vi.fn().mockResolvedValue(undefined),
  createNotificationForClient: vi.fn().mockResolvedValue(undefined),
  notifyUserByEmail: vi.fn(),
  notifyUserByEmailWithContext: vi.fn(),
  notifyTeamByEmail: vi.fn(),
}));

// ── Mock: @/lib/supabase ───────────────────────────────────────────────────

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockRemove = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: {
    publicUrl:
      "https://test.supabase.co/storage/v1/object/public/test/file.png",
  },
});
const mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
  data: {
    signedUrl:
      "https://test.supabase.co/storage/v1/upload/sign/attachments/test-path?token=signed-token",
    path: "user-test-001/1700000000000-file.pdf",
    token: "signed-token",
  },
  error: null,
});

const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
  createSignedUploadUrl: mockCreateSignedUploadUrl,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    storage: { from: mockStorageFrom },
  })),
}));

// ── Mock: @/lib/logger ─────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock: better-auth/crypto ────────────────────────────────────────────────

vi.mock("better-auth/crypto", () => ({
  verifyPassword: vi.fn().mockResolvedValue(false),
}));

// ── Mock: @/lib/rateLimit ───────────────────────────────────────────────────

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
}));

// ── Mock: @/env ─────────────────────────────────────────────────────────────

vi.mock("@/env", () => ({
  env: vi.fn(() => ({
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    BETTER_AUTH_SECRET: "test-secret-at-least-32-chars-long!!",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
    SMTP_HOST: "smtp.test.com",
    SMTP_PORT: "587",
  })),
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

// ── Mock: @/lib/queries (default no-op, tests override per-function) ────────

vi.mock("@/lib/queries", () => ({
  hasProjectAccess: vi.fn().mockResolvedValue(true),
  getOrgRole: vi.fn().mockResolvedValue("owner"),
  getProjectsByOrgId: vi.fn().mockResolvedValue([]),
  getProjectsByArchitectId: vi.fn().mockResolvedValue([]),
  getProjectById: vi.fn().mockResolvedValue(null),
  createProjectWithPhases: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getUsersByIds: vi.fn().mockResolvedValue([]),
  checkUserExistsByEmail: vi.fn().mockResolvedValue(false),
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markAllNotificationsRead: vi.fn(),
  markNotificationsReadByIds: vi.fn(),
  deleteNotification: vi.fn(),
  deleteAllNotifications: vi.fn(),
  getAttachmentsByProject: vi.fn().mockResolvedValue([]),
  getAttachments: vi.fn().mockResolvedValue([]),
  createAttachment: vi.fn(),
  createProjectAttachment: vi.fn(),
  getAttachmentById: vi.fn().mockResolvedValue(null),
  getAttachmentVersionHistory: vi.fn().mockResolvedValue([]),
  updateAttachmentStatus: vi.fn(),
  deleteAttachment: vi.fn(),
  verifyResourceOwnership: vi.fn().mockResolvedValue(null),
  uploadNewVersion: vi.fn(),
  getProjectName: vi.fn().mockResolvedValue("Test Project"),
  getPhaseTasks: vi.fn().mockResolvedValue([]),
  verifyPhaseOwnership: vi.fn().mockResolvedValue(true),
  createPhaseTask: vi.fn(),
  updatePhaseTask: vi.fn(),
  getTasksPendingReview: vi.fn().mockResolvedValue([]),
  markPhaseTaskForReview: vi.fn(),
  getProjectReviewInfo: vi.fn().mockResolvedValue(null),
  getPhaseTaskPendingReview: vi.fn().mockResolvedValue(null),
  updatePhaseTaskReviewStatus: vi.fn(),
  getTaskById: vi.fn().mockResolvedValue(null),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasksFiltered: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
  getTaskBucketCounts: vi.fn().mockResolvedValue({}),
  getMemberRole: vi.fn().mockResolvedValue("owner"),
  validateOrgMembership: vi.fn().mockResolvedValue(true),
  validateProjectInOrg: vi.fn().mockResolvedValue(true),
  toggleTaskStar: vi.fn(),
  getChecklistItems: vi.fn().mockResolvedValue([]),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  reorderChecklistItems: vi.fn(),
  getPinComments: vi.fn().mockResolvedValue([]),
  createPinComment: vi.fn(),
  createPinWithTask: vi.fn(),
  getPinCommentById: vi.fn().mockResolvedValue(null),
  updatePinComment: vi.fn(),
  updatePinCommentContent: vi.fn(),
  updatePinCommentPosition: vi.fn(),
  deletePinComment: vi.fn(),
  getPinCommentReplies: vi.fn().mockResolvedValue([]),
  submitAttachmentReview: vi
    .fn()
    .mockResolvedValue({ attachment: null, conflict: false }),
  createAttachmentReview: vi.fn(),
  getAttachmentReviews: vi.fn().mockResolvedValue([]),
  setAttachmentFreezeStatus: vi
    .fn()
    .mockResolvedValue({ error: null, data: null }),
  markAttachmentSentToClient: vi.fn().mockResolvedValue(null),
  getProjectClientInfo: vi.fn().mockResolvedValue(null),
  getComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn(),
  getApprovals: vi.fn().mockResolvedValue([]),
  createApproval: vi.fn(),
  markProjectCompletedIfAllPhasesComplete: vi.fn(),
  getProjectTeamEmails: vi.fn().mockResolvedValue([]),
  isEmailTaken: vi.fn().mockResolvedValue(false),
  createPendingEmailChange: vi.fn().mockResolvedValue({ token: "test-token" }),
  getPendingEmailChange: vi.fn().mockResolvedValue(null),
  deletePendingEmailChange: vi.fn(),
  incrementFailedAttempts: vi.fn().mockResolvedValue(1),
  updateUserEmail: vi.fn(),
  getAccountPasswordHash: vi.fn().mockResolvedValue(null),
  verifyTaskAccess: vi.fn().mockResolvedValue(true),
  verifyTaskOwnership: vi.fn().mockResolvedValue(true),
  getTaskAttachments: vi.fn().mockResolvedValue([]),
  getTaskProjectId: vi.fn().mockResolvedValue("project-test-001"),
  createTaskAttachment: vi.fn(),
  getTaskOrgId: vi.fn().mockResolvedValue("org-test-001"),
  getStandaloneTaskAttachment: vi.fn().mockResolvedValue(null),
  deleteAttachmentById: vi.fn(),
  getTasksByAssignee: vi.fn().mockResolvedValue([]),
  getProjectForSendToClient: vi.fn().mockResolvedValue(null),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  createClientUser: vi.fn(),
  getDashboardStats: vi.fn().mockResolvedValue(null),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  getProjectsByClientEmail: vi.fn().mockResolvedValue([]),
  clearClientEmailByEmail: vi.fn().mockResolvedValue(0),
  // Element Categories
  buildCategoryTree: vi.fn().mockReturnValue([]),
  getCategoryTree: vi.fn().mockResolvedValue([]),
  getCategoryById: vi.fn().mockResolvedValue(null),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn().mockResolvedValue({ deleted: true }),
  reorderCategories: vi.fn(),
  // Elements
  getElements: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getElementById: vi.fn().mockResolvedValue(null),
  createElement: vi.fn(),
  updateElement: vi.fn(),
  softDeleteElement: vi.fn().mockResolvedValue({ deleted: true }),
  restoreElement: vi.fn().mockResolvedValue({ restored: true }),
  duplicateElement: vi.fn(),
  getVersionHistory: vi.fn().mockResolvedValue([]),
  getElementsForExport: vi
    .fn()
    .mockResolvedValue({ rows: [], total: 0, truncated: false }),
  bulkUpsertElements: vi.fn().mockResolvedValue({
    inserted: 0,
    updated: 0,
    skipped: 0,
    versioned: 0,
    failed: [],
  }),
  // Default: pass through to `run()` and report as fresh — idempotency is
  // a production concern, not a unit-test one. Tests that care about
  // replay behaviour override this directly.
  withImportIdempotency: vi.fn(
    async (_key: string, run: () => Promise<unknown>) => ({
      result: await run(),
      replayed: false,
    })
  ),
  EmailTakenError: class EmailTakenError extends Error {
    constructor() {
      super("This email is already in use");
      this.name = "EmailTakenError";
    }
  },
  // BOQ (Feature 4)
  verifyBoqOwnership: vi.fn().mockResolvedValue(true),
  verifyBoqSectionOwnership: vi.fn().mockResolvedValue(true),
  verifyBoqItemOwnership: vi.fn().mockResolvedValue(true),
  createBoq: vi.fn(),
  getBoq: vi.fn().mockResolvedValue(null),
  getBoqByProject: vi.fn().mockResolvedValue(null),
  updateBoq: vi.fn().mockResolvedValue(null),
  createBoqSection: vi.fn(),
  updateBoqSection: vi.fn().mockResolvedValue(null),
  deleteBoqSection: vi.fn().mockResolvedValue(true),
  reorderBoqSections: vi.fn().mockResolvedValue(undefined),
  createBoqItem: vi.fn(),
  updateBoqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  deleteBoqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  reorderBoqItems: vi.fn().mockResolvedValue(undefined),
  addElementToBoq: vi.fn().mockResolvedValue(null),
  getBoqSummary: vi.fn().mockResolvedValue({
    total_cost: "0",
    total_sell_price: "0",
    subtotal: "0",
    pre_vat_total: "0",
    client_total: "0",
    average_margin_pct: "0",
    margin_bleed_count: 0,
    pending_approvals: 0,
    item_count: 0,
    section_totals: [],
  }),
  getNextSequenceNumber: vi.fn().mockResolvedValue("BOQ-2026-001"),
}));

// ── Export mock handles for test files ───────────────────────────────────────

export const mocks = {
  db: { query: mockQuery, connect: mockConnect },
  auth: {
    getSession: mockGetSession,
    listOrganizations: mockListOrganizations,
    listMembers: mockListMembers,
    setActiveOrganization: mockSetActiveOrganization,
    signInMagicLink: mockSignInMagicLink,
  },
  supabase: {
    storageFrom: mockStorageFrom,
    upload: mockUpload,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
    createSignedUploadUrl: mockCreateSignedUploadUrl,
  },
};
