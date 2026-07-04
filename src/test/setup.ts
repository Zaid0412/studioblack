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
// 32-byte test key for vendor bank-details encryption (F7).
process.env.VENDOR_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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
  sendRfqIssuedEmail: vi.fn().mockResolvedValue(undefined),
  sendQuoteReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendQuoteAwardedEmail: vi.fn().mockResolvedValue(undefined),
  sendClientBoqEmail: vi.fn().mockResolvedValue(undefined),
  escapeHtml: vi.fn((s: string) => s),
}));

// ── Mock: @/lib/boq/pdf (PDF renderer — Vercel-heavy; stubbed in tests) ─────

vi.mock("@/lib/boq/pdf", () => ({
  renderBoqPdf: vi.fn().mockResolvedValue(Buffer.from("mock-pdf")),
  buildBoqPdfFilename: vi.fn(
    (name: string, date?: string) =>
      `BoQ - ${name} - ${date ?? "2026-05-30"}.pdf`
  ),
}));

// ── Mock: @/lib/notifications ───────────────────────────────────────────────

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationsForTeam: vi.fn().mockResolvedValue(undefined),
  createNotificationForClient: vi.fn().mockResolvedValue(undefined),
  notifyUserByEmail: vi.fn(),
  notifyUserByEmailWithContext: vi.fn(),
  notifyTeamByEmail: vi.fn(),
  notifyPmAssignment: vi.fn(),
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
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: {
    signedUrl:
      "https://test.supabase.co/storage/v1/object/sign/documents/test-path?token=signed-token",
  },
  error: null,
});

const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
  createSignedUploadUrl: mockCreateSignedUploadUrl,
  createSignedUrl: mockCreateSignedUrl,
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
    VENDOR_ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
  getProjectsByPmId: vi.fn().mockResolvedValue([]),
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
  isProjectPm: vi.fn().mockResolvedValue(false),
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
  // Task comments
  getTaskComment: vi.fn().mockResolvedValue(null),
  createTaskComment: vi.fn(),
  updateTaskComment: vi.fn().mockResolvedValue(null),
  deleteTaskComment: vi.fn().mockResolvedValue(false),
  // Task activity
  getTaskActivity: vi.fn().mockResolvedValue([]),
  logTaskFieldChanges: vi.fn().mockResolvedValue(undefined),
  getProjectForSendToClient: vi.fn().mockResolvedValue(null),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  createClientUser: vi.fn(),
  getDashboardStats: vi.fn().mockResolvedValue(null),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  getPendingReviews: vi.fn().mockResolvedValue([]),
  getPendingBoqReviews: vi.fn().mockResolvedValue([]),
  getClientPendingReviews: vi
    .fn()
    .mockResolvedValue({ files: [], boqs: [], total: 0 }),
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
  bulkCreateCategoriesFromTemplates: vi
    .fn()
    .mockResolvedValue({ created: [], skipped: [] }),
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
  // Per-item lifecycle phase (Pap's 2026-05-12 spec)
  getEligibleReviewers: vi.fn().mockResolvedValue([]),
  getLastPhaseActors: vi.fn().mockResolvedValue(new Map()),
  getProjectStaffIds: vi.fn().mockResolvedValue([]),
  getLatestBoqItemChangeRequest: vi.fn().mockResolvedValue(null),
  getBoqItemContext: vi.fn().mockResolvedValue(null),
  getBoqItemHistory: vi.fn().mockResolvedValue([]),
  CLIENT_VISIBLE_PHASES: [
    "sent_to_client",
    "client_reviewing",
    "client_changes_requested",
    "client_approved",
    "ready_for_procurement",
  ],
  setBoqItemPhase: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  setBoqItemsPhase: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "wrong_boq" }),
  createBoqSection: vi.fn(),
  updateBoqSection: vi.fn().mockResolvedValue(null),
  deleteBoqSection: vi.fn().mockResolvedValue(true),
  reorderBoqSections: vi.fn().mockResolvedValue(undefined),
  createBoqItem: vi.fn(),
  updateBoqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  getBoqItemVersions: vi.fn().mockResolvedValue([]),
  applyRateContractToBoqItem: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  deleteBoqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  moveBoqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  moveBoqItemsBulk: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  deleteBoqItemsBulk: vi.fn().mockResolvedValue({ deleted: 0, blocked: 0 }),
  reorderBoqItems: vi.fn().mockResolvedValue(undefined),
  addElementToBoq: vi.fn().mockResolvedValue(null),
  addElementsToBoq: vi.fn().mockResolvedValue(null),
  getBoqSummary: vi.fn().mockResolvedValue({
    total_cost: "0",
    total_sell_price: "0",
    subtotal: "0",
    pre_vat_total: "0",
    client_total: "0",
    average_margin_pct: "0",
    margin_bleed_count: 0,
    pending_approvals: 0,
    over_budget_count: 0,
    item_count: 0,
    section_totals: [],
  }),
  getNextSequenceNumber: vi.fn().mockResolvedValue("BOQ-2026-001"),
  // BOQ Excel import/export (Feature 6)
  getElementsByCodeMap: vi.fn().mockResolvedValue(new Map()),
  getBoqForExport: vi.fn().mockResolvedValue(null),
  getBoqItemsForPdf: vi.fn().mockResolvedValue(null),
  bulkInsertBoqItems: vi.fn().mockResolvedValue({
    inserted: 0,
    replaced: 0,
    createdSections: [],
    failed: [],
  }),
  // Pass-through idempotency — tests that care about replay override this.
  withBoqImportIdempotency: vi.fn(
    async (_key: string, run: () => Promise<unknown>) => ({
      result: await run(),
      replayed: false,
    })
  ),
  // Vendors (Feature 7)
  getVendors: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getVendorById: vi.fn().mockResolvedValue(null),
  getVendorBankDetailsEnvelope: vi
    .fn()
    .mockResolvedValue({ exists: false, envelope: null }),
  getVendorsByTrade: vi.fn().mockResolvedValue([]),
  createVendor: vi.fn(),
  updateVendor: vi.fn().mockResolvedValue(null),
  updateVendorBankDetails: vi.fn().mockResolvedValue(true),
  updateVendorRating: vi.fn().mockResolvedValue(null),
  softDeleteVendor: vi.fn().mockResolvedValue(true),
  hardDeleteVendor: vi.fn().mockResolvedValue(true),
  // Vendor KYC (Feature 7.1)
  addKycDocument: vi.fn().mockResolvedValue(null),
  listKycDocuments: vi.fn().mockResolvedValue([]),
  removeKycDocument: vi.fn().mockResolvedValue(true),
  setKycStatus: vi.fn().mockResolvedValue(null),
  // Vendor invite / linking (Feature 8)
  getVendorContactEmail: vi.fn().mockResolvedValue(null),
  linkVendorContactByEmail: vi.fn().mockResolvedValue(undefined),
  // Vendor Portal — Self-Service (Feature 8.5)
  getVendorIdByUserId: vi.fn().mockResolvedValue(null),
  getVendorSelfById: vi.fn().mockResolvedValue(null),
  getVendorBankDetailsEnvelopeById: vi
    .fn()
    .mockResolvedValue({ exists: false, envelope: null }),
  updateVendorSelf: vi.fn().mockResolvedValue(null),
  updateVendorBankDetailsById: vi.fn().mockResolvedValue(true),
  listKycDocumentsByVendorId: vi.fn().mockResolvedValue([]),
  addKycDocumentBySelf: vi.fn().mockResolvedValue(null),
  removeKycDocumentBySelf: vi.fn().mockResolvedValue(true),
  addVendorContactSelf: vi.fn().mockResolvedValue({ id: "contact-test-001" }),
  updateVendorContactSelf: vi.fn().mockResolvedValue(true),
  deleteVendorContactSelf: vi.fn().mockResolvedValue({ ok: true }),
  // Rate Contracts (Feature 7.5)
  listRateContracts: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getRateContractById: vi.fn().mockResolvedValue(null),
  getActiveRatesForBoqItem: vi.fn().mockResolvedValue([]),
  getAvailableRatesForBoqPicker: vi.fn().mockResolvedValue([]),
  createRateContract: vi.fn(),
  updateRateContract: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  transitionRateContract: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  addRateContractItems: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  removeRateContractItem: vi.fn().mockResolvedValue(true),
  // RFQ (Feature 9)
  verifyRfqOwnership: vi.fn().mockResolvedValue(true),
  getRfqsByProject: vi
    .fn()
    .mockResolvedValue({ rows: [], total: 0, readyNotInRfq: 0 }),
  getRfqDetail: vi.fn().mockResolvedValue(null),
  getSuggestedVendorsForRfq: vi.fn().mockResolvedValue([]),
  getAllVendorsForRfq: vi.fn().mockResolvedValue([]),
  getRfqsForVendor: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getRfqDetailForVendor: vi.fn().mockResolvedValue(null),
  getRfqContactsForEmail: vi.fn().mockResolvedValue([]),
  createRfqDraft: vi.fn(),
  updateRfqDraft: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  issueRfq: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  inviteRfqVendors: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  addRfqItems: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  removeRfqItem: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  updateRfqItemAttachments: vi.fn().mockResolvedValue({ ok: true }),
  getRfqVendorName: vi.fn().mockResolvedValue(null),
  cancelRfq: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
  cloneRfqAsRevision: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  syncRfqItemsFromBoq: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  // Vendor Quotes (Feature 10)
  getQuotesByRfq: vi.fn().mockResolvedValue([]),
  getQuoteDetail: vi.fn().mockResolvedValue(null),
  getQuoteForVendor: vi.fn().mockResolvedValue(null),
  getQuoteVersionHistory: vi.fn().mockResolvedValue([]),
  getQuoteComparison: vi.fn().mockResolvedValue({
    rfq_id: "",
    items: [],
    vendors: [],
    invited_no_response: [],
  }),
  getQuoteStudioRecipients: vi.fn().mockResolvedValue([]),
  submitOrUpdateQuote: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "rfq_not_found" }),
  setQuoteUnderReview: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "not_found" }),
  awardRfqSingle: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "rfq_not_found" }),
  awardRfqSplit: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "rfq_not_found" }),
  // Audit (introduced with F7, reused by F21)
  logAudit: vi.fn().mockResolvedValue(undefined),
  logAuditSafe: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    VENDOR_BANK_READ: "vendor.bank_details.read",
    VENDOR_BANK_WRITE: "vendor.bank_details.write",
    VENDOR_BANK_CLEAR: "vendor.bank_details.clear",
    VENDOR_KYC_DOCUMENT_ADDED: "vendor.kyc.document_added",
    VENDOR_KYC_DOCUMENT_REMOVED: "vendor.kyc.document_removed",
    VENDOR_KYC_STATUS_CHANGED: "vendor.kyc.status_changed",
    VENDOR_PROFILE_UPDATED: "vendor.profile.updated",
    VENDOR_CONTACT_ADDED: "vendor.contact.added",
    VENDOR_CONTACT_UPDATED: "vendor.contact.updated",
    VENDOR_CONTACT_REMOVED: "vendor.contact.removed",
    RATE_CONTRACT_ACTIVATED: "rate_contract.activated",
    RATE_CONTRACT_CANCELLED: "rate_contract.cancelled",
    RFQ_CREATED: "rfq.created",
    RFQ_UPDATED: "rfq.updated",
    RFQ_ISSUED: "rfq.issued",
    RFQ_VENDORS_ADDED: "rfq.vendors_added",
    RFQ_CANCELLED: "rfq.cancelled",
    RFQ_AWARDED: "rfq.awarded",
    RFQ_REVISED: "rfq.revised",
    RFQ_SYNCED_FROM_BOQ: "rfq.synced_from_boq",
    RFQ_COMMUNICATION_LOGGED: "rfq.communication_logged",
    QUOTE_SUBMITTED: "quote.submitted",
    QUOTE_REVISED: "quote.revised",
    QUOTE_UNDER_REVIEW: "quote.under_review",
    QUOTE_AWARDED: "quote.awarded",
    QUOTE_REJECTED: "quote.rejected",
    QUOTE_EXPIRED: "quote.expired",
  } as const,
  AUDIT_SOURCES: {
    SELF_SERVICE: "self_service",
  } as const,
  getAuditEvents: vi.fn().mockResolvedValue([]),
  // Project Documents
  listDocumentSections: vi.fn().mockResolvedValue([]),
  getDocumentSectionById: vi.fn().mockResolvedValue(null),
  createDocumentSection: vi.fn(),
  updateDocumentSection: vi.fn().mockResolvedValue(null),
  deleteDocumentSection: vi.fn().mockResolvedValue([]),
  listSectionDocuments: vi.fn().mockResolvedValue([]),
  listProjectDocuments: vi.fn().mockResolvedValue([]),
  getDocumentById: vi.fn().mockResolvedValue(null),
  createDocument: vi.fn(),
  updateDocument: vi.fn().mockResolvedValue(null),
  deleteDocument: vi.fn().mockResolvedValue(null),
  getLatestVersionForDocument: vi.fn().mockResolvedValue(null),
  getDocumentVersionHistory: vi.fn().mockResolvedValue(null),
  createDocumentVersion: vi.fn().mockResolvedValue(null),
  revertDocumentToVersion: vi.fn().mockResolvedValue(null),
  deleteDocumentVersion: vi.fn().mockResolvedValue(null),
  isStoragePathInUse: vi.fn().mockResolvedValue(false),
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
    createSignedUrl: mockCreateSignedUrl,
  },
};
