import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "@/lib/constants";

// ─── Shared constants ───────────────────────────────────────────────────────

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "completed",
  "archived",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Bucket keys for the redesigned task page sidebar. Grouped by section in the
 * UI (`PERSONAL`, `TASKS`, `APPROVALS`, `ALL`).
 *
 * `reminders` and `mentions` are intentionally part of the union but commented
 * out in the sidebar's render list — they require the `task_reminder` table
 * (Phase 2) and `@`-mention parser (Phase 3). Keeping them in the type means
 * uncommenting one line is enough to enable them.
 *
 * The approval-related buckets (`my_requests`, `my_approvals`, `my_comments`,
 * `all_requests`) are wired through the API but currently return empty
 * results — full data joins land with the multi-domain Request entity work
 * (Phase 4 in the redesign plan).
 */
export const TASK_BUCKETS = [
  // PERSONAL
  "important",
  "reminders",
  "mentions",
  // TASKS
  "tasks_for_me",
  "tasks_by_me",
  // APPROVALS
  "my_requests",
  "my_approvals",
  "my_comments",
  // ALL
  "all_tasks",
  "all_requests",
] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

/**
 * Buckets sourced from `pin_comment` / `comment` rather than the `task` table.
 * `my_approvals` is included so list and empty-state code paths agree, even
 * though it currently returns 0 rows (no reviewer concept yet — see Phase 4).
 */
export const APPROVAL_BUCKETS: ReadonlySet<TaskBucket> = new Set([
  "my_requests",
  "my_approvals",
  "my_comments",
  "all_requests",
]);
/** Whether the bucket reads from `pin_comment` / `comment` instead of `task`. */
export function isApprovalBucket(bucket: TaskBucket): boolean {
  return APPROVAL_BUCKETS.has(bucket);
}

export const TASK_CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export const PROJECT_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export const PROJECT_CATEGORIES = [
  "residential",
  "commercial",
  "healthcare",
  "hospitality",
  "institutional",
  "retail",
  "workspace",
] as const;
export const REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "request_changes",
] as const;
export const ATTACHMENT_REVIEW_STATUSES = ["approved", "rejected"] as const;
export const PHASE_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
] as const;
export const APPROVAL_DECISIONS = ["approved", "changes_requested"] as const;

// ─── BOQ (Feature 4) ────────────────────────────────────────────────────────

export const BOQ_STATUSES = [
  "draft",
  "pending_internal_review",
  "internally_approved",
  "changes_requested",
  "submitted_to_client",
  "client_approved",
  "locked",
  "superseded",
] as const;
export type BoqStatus = (typeof BOQ_STATUSES)[number];

export const BOQ_ITEM_LIFECYCLE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "queried",
  "locked",
  "change_order_pending",
  "superseded",
] as const;
export type BoqItemLifecycleStatus =
  (typeof BOQ_ITEM_LIFECYCLE_STATUSES)[number];

export const BOQ_ITEM_CLIENT_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "queried",
] as const;
export type BoqItemClientApprovalStatus =
  (typeof BOQ_ITEM_CLIENT_APPROVAL_STATUSES)[number];

export const BOQ_ITEM_PO_STATUSES = [
  "none",
  "rfq_issued",
  "quoted",
  "po_raised",
  "delivered",
] as const;
export type BoqItemPoStatus = (typeof BOQ_ITEM_PO_STATUSES)[number];

export const BOQ_ITEM_SOURCES = [
  "custom",
  "library",
  "project",
  "rate_contract",
] as const;
export type BoqItemSource = (typeof BOQ_ITEM_SOURCES)[number];

// ─── Reusable primitives ────────────────────────────────────────────────────

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional();
/** better-auth generates non-UUID user IDs (nanoid), so validate as non-empty string. */
const userId = z.string().min(1);
const optionalUserId = z.string().min(1).optional();
const trimmedString = z.string().trim().min(1);
const optionalString = z.string().optional();

/**
 * URL pointing at a Supabase Storage object — public or signed.
 *
 * Refuses arbitrary external URLs and non-https schemes (blocks `javascript:`,
 * `data:`, hotlinked trackers, etc.). The signed-URL upload route is the only
 * path that produces these URLs server-side, and they always carry the
 * `/storage/v1/object/...` prefix.
 */
const supabaseStorageUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          parsed.protocol === "https:" &&
          parsed.pathname.startsWith("/storage/v1/object/")
        );
      } catch {
        return false;
      }
    },
    { message: "must be a Supabase Storage URL" }
  );

// ─── Tasks (/api/tasks) ─────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: trimmedString,
  description: optionalString,
  projectId: optionalUuid,
  phaseId: optionalUuid,
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assignedTo: optionalUserId,
  dueDate: z.string().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assignedTo: z.string().min(1).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  phaseId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  reminderAt: z.string().optional().nullable(),
});

// ─── Projects (/api/projects) ───────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: trimmedString,
  clientName: optionalString,
  clientEmail: z.string().email().optional().nullable(),
  category: z.enum(PROJECT_CATEGORIES),
  deadline: z.string().optional().nullable(),
  scope: optionalString,
  areaSqft: z.number().optional().nullable(),
  estimationInr: z.number().optional().nullable(),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  phases: z.array(z.string()).optional(),
  architectIds: z.array(z.string().min(1)).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  clientName: z.string().optional().nullable(),
  clientEmail: z.string().email().optional().nullable(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  deadline: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  areaSqft: z.number().optional().nullable(),
  estimationInr: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  architectIds: z.array(z.string().min(1)).optional(),
});

// ─── Notifications (/api/notifications) ─────────────────────────────────────

export const patchNotificationsSchema = z.object({
  markAllRead: z.boolean().optional(),
  ids: z.array(uuid).optional(),
});

export const deleteNotificationsSchema = z.object({
  id: uuid.optional(),
});

// ─── Attachments (/api/projects/[id]/attachments) ───────────────────────────

export const createProjectAttachmentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: trimmedString,
  description: z.string().max(2000).optional(),
  phaseId: optionalUuid,
  taskId: optionalUuid,
  versionGroup: optionalUuid,
});

export const updateAttachmentStatusSchema = z.object({
  reviewStatus: z.enum(REVIEW_STATUSES),
});

// ─── Task Attachments (/api/tasks/[id]/attachments) ─────────────────────────

export const createTaskAttachmentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: trimmedString,
  fileSize: z.number().optional().nullable(),
});

// ─── Attachment Review ──────────────────────────────────────────────────────

export const submitReviewSchema = z.object({
  status: z.enum(ATTACHMENT_REVIEW_STATUSES),
  comment: z.string().optional(),
  annotatedFileUrl: z.string().url().optional().nullable(),
  annotationCount: z.number().int().min(0).optional(),
});

// ─── Pin Comments (/api/projects/[id]/attachments/[attachmentId]/pins) ──────

export const createPinSchema = z.object({
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  x_percent: z.number().min(0).max(100).optional().nullable(),
  y_percent: z.number().min(0).max(100).optional().nullable(),
  page: z.number().int().min(1).optional().nullable(),
  request_changes: z.boolean().optional(),
  assign_as_task: z
    .object({
      assigned_to: userId,
      due_date: z.string().optional().nullable(),
    })
    .optional(),
  parent_id: optionalUuid,
});

export const updatePinSchema = z.object({
  resolved: z.boolean().optional(),
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH).optional(),
  x_percent: z.number().min(0).max(100).optional(),
  y_percent: z.number().min(0).max(100).optional(),
  page: z.number().int().min(1).optional(),
});

// ─── Approvals (/api/projects/[id]/approvals) ───────────────────────────────

export const createApprovalSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  comment: z.string().optional(),
  phaseId: optionalUuid,
});

// ─── Comments (/api/projects/[id]/comments) ─────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  phaseId: optionalUuid,
  taskId: optionalUuid,
});

// ─── Task Comments (/api/tasks/[id]/comments) ───────────────────────────────

const taskCommentAttachmentSchema = z.object({
  url: supabaseStorageUrl,
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(127),
  size: z.number().int().nonnegative().nullable(),
});

export const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  attachments: z.array(taskCommentAttachmentSchema).max(20).optional(),
});

export const updateTaskCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(MAX_CONTENT_LENGTH).optional(),
    attachments: z.array(taskCommentAttachmentSchema).max(20).optional(),
  })
  .refine((v) => v.body !== undefined || v.attachments !== undefined, {
    message: "Provide body or attachments",
  });

// ─── Phase Tasks (/api/projects/[id]/tasks) ─────────────────────────────────

export const createPhaseTaskSchema = z.object({
  phaseId: uuid,
  title: trimmedString,
  description: optionalString,
  assignedTo: optionalUserId,
  dueDate: z.string().optional().nullable(),
});

export const updatePhaseTaskSchema = z.object({
  taskId: uuid,
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(PHASE_TASK_STATUSES).optional(),
  assignedTo: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  requiresClientReview: z.boolean().optional(),
});

// ─── Phase Task Review (/api/projects/[id]/tasks/[taskId]/review) ───────────

export const submitTaskReviewSchema = z.object({
  action: z.enum(APPROVAL_DECISIONS),
  comment: z.string().optional(),
});

// ─── Checklist (/api/tasks/[id]/checklist) ──────────────────────────────────

export const createChecklistItemSchema = z.object({
  title: trimmedString,
});

export const updateChecklistItemSchema = z.object({
  title: z.string().trim().min(1).optional(),
  is_done: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderChecklistSchema = z.object({
  orderedIds: z.array(uuid).min(1),
});

// ─── Element Categories (/api/element-categories) ──────────────────────────

export const createElementCategorySchema = z.object({
  name: trimmedString.max(150),
  parentId: optionalUuid,
  codePrefix: z.string().max(10).optional(),
  sortOrder: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const updateElementCategorySchema = z.object({
  name: trimmedString.max(150).optional(),
  codePrefix: z.string().max(10).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

const bulkCategoryChild = z.object({
  name: trimmedString.max(150),
  codePrefix: z.string().max(10).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

const bulkCategoryNode = bulkCategoryChild.extend({
  children: z.array(bulkCategoryChild).max(20).optional(),
});

export const bulkCreateCategoriesSchema = z.object({
  categories: z.array(bulkCategoryNode).min(1).max(20),
});

export type BulkCategoryNode = z.infer<typeof bulkCategoryNode>;

export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  orderedIds: z.array(uuid).min(1),
});

// ─── Elements (/api/elements) ───────────────────────────────────────────────

export const ALLOWED_UNITS = [
  "m2",
  "m3",
  "lm",
  "no",
  "item",
  "kg",
  "tonne",
  "ls",
  "set",
  "pair",
  "roll",
  "sheet",
  "bag",
  "box",
  "pallet",
] as const;
export type ElementUnit = (typeof ALLOWED_UNITS)[number];

const elementAttributeInput = z.object({
  attribute_key: z.string().trim().min(1).max(100),
  attribute_value: z.string().trim().min(1),
  unit: z.string().trim().max(30).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const nonNegativeMoney = z.number().nonnegative().finite();
const percent = z.number().min(0).max(100).finite();

export const createElementSchema = z.object({
  code: trimmedString.max(50),
  name: trimmedString.max(255),
  description: z.string().trim().optional(),
  categoryId: optionalUuid,
  unit: z.enum(ALLOWED_UNITS),
  unitCost: nonNegativeMoney,
  currency: z.string().trim().length(3).default("USD"),
  materialCost: nonNegativeMoney.optional(),
  labourCost: nonNegativeMoney.optional(),
  overheadPct: percent.optional(),
  serviceChargePct: percent.optional(),
  marginPct: percent.optional(),
  // Independent of `unit_cost` and `sell_price`. `clientRate` is the
  // client-facing price (used at markup ladders / project-tier discounts);
  // `budgetRate` is the internal cost target for variance tracking.
  clientRate: nonNegativeMoney.optional().nullable(),
  budgetRate: nonNegativeMoney.optional().nullable(),
  specReference: z.string().trim().max(255).optional(),
  drawingRef: z.string().trim().max(255).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  attributes: z.array(elementAttributeInput).optional(),
  imageUrl: supabaseStorageUrl.optional().nullable(),
  drawingFileUrl: supabaseStorageUrl.optional().nullable(),
  drawingFileName: z.string().trim().max(255).optional().nullable(),
  specFileUrl: supabaseStorageUrl.optional().nullable(),
  specFileName: z.string().trim().max(255).optional().nullable(),
});

export const updateElementSchema = createElementSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/** Shared by every sort-aware list endpoint. */
export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const ELEMENT_SORT_FIELDS = [
  "code",
  "name",
  "unit_cost",
  "updated_at",
] as const;
export type ElementSortField = (typeof ELEMENT_SORT_FIELDS)[number];

export const listElementsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  unit: z.enum(ALLOWED_UNITS).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
  sortBy: z.enum(ELEMENT_SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

// ─── Element Excel Import / Export (F3) ────────────────────────────────────

export const DUPLICATE_STRATEGIES = ["skip", "overwrite", "version"] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

/** Max accepted Excel upload size (bytes). */
export const ELEMENT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Shape of a single parsed row as sent back from the client to the
 * confirm endpoint. The server re-validates every field — never trust
 * the first-pass parse result.
 */
export const importElementRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  code: trimmedString.max(50),
  name: trimmedString.max(255),
  // Cap description to protect the confirm endpoint from OOM: without a
  // max, a crafted row with a 10 MB description × 10k rows = 100 GB of
  // JSON, which would blow through the body limit before any handler runs.
  description: z.string().trim().max(2000).optional(),
  categoryPath: z.array(z.string().trim().min(1)).optional(),
  unit: z.enum(ALLOWED_UNITS),
  unitCost: nonNegativeMoney,
  currency: z.string().trim().length(3).optional(),
  materialCost: nonNegativeMoney.optional(),
  labourCost: nonNegativeMoney.optional(),
  overheadPct: percent.optional(),
  serviceChargePct: percent.optional(),
  marginPct: percent.optional(),
  clientRate: nonNegativeMoney.optional(),
  budgetRate: nonNegativeMoney.optional(),
  specReference: z.string().trim().max(255).optional(),
  drawingRef: z.string().trim().max(255).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const importConfirmSchema = z.object({
  strategy: z.enum(DUPLICATE_STRATEGIES),
  rows: z.array(importElementRowSchema).min(1).max(10_000),
});

// ─── BOQ (Feature 4) ────────────────────────────────────────────────────────

const money = z.coerce.number().min(0).finite();
const quantity = z.coerce.number().min(0).finite();
const boqPercent = z.coerce.number().min(0).max(100).finite();
/** Optimistic-lock token — clients echo the row's `updated_at` on mutations. */
const updatedAtToken = z.string().min(1);

export const createBoqSchema = z.object({
  title: trimmedString.max(255),
  currency: z.string().length(3).optional(),
  exchangeRate: z.coerce.number().positive().finite().optional(),
  contingencyPct: boqPercent.optional(),
  vatPct: boqPercent.optional(),
  minimumMarginPct: boqPercent.optional(),
  clientId: optionalUserId.nullable(),
  architectId: optionalUserId.nullable(),
  notes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
});

export const updateBoqSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.coerce.number().positive().finite().optional(),
  contingencyPct: boqPercent.optional(),
  vatPct: boqPercent.optional(),
  minimumMarginPct: boqPercent.optional(),
  clientId: z.string().min(1).nullable().optional(),
  architectId: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  status: z.enum(BOQ_STATUSES).optional(),
});

/** Approve a BOQ internally — comment is optional. */
export const approveBoqSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

/** Request changes — comment is REQUIRED, otherwise the creator
 * gets bounced back with no signal about what to fix. */
export const requestBoqChangesSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});

/**
 * Allowed BOQ status transitions. Any other src→dst pair is rejected at the
 * route layer. Locked and superseded are terminal — no transitions out.
 */
export const BOQ_STATUS_TRANSITIONS: Record<BoqStatus, BoqStatus[]> = {
  // The internal-review gate sits between draft and the existing
  // client-facing flow. Each non-terminal state has a `→ draft` escape
  // hatch so the creator (or, in some cases, a PM) can pull the BOQ
  // back to draft for a major restructuring without going through the
  // review round-trip.
  draft: ["pending_internal_review"],
  pending_internal_review: [
    "internally_approved",
    "changes_requested",
    "draft", // creator self-cancel
  ],
  internally_approved: ["submitted_to_client", "draft"],
  changes_requested: ["pending_internal_review", "draft"],
  submitted_to_client: ["draft", "client_approved"],
  client_approved: ["locked", "draft"],
  locked: [],
  superseded: [],
};

export const createBoqSectionSchema = z.object({
  title: trimmedString.max(255),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  budgetCap: money.optional().nullable(),
  isVisibleToClient: z.boolean().optional(),
});

export const updateBoqSectionSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  budgetCap: money.nullable().optional(),
  isVisibleToClient: z.boolean().optional(),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(uuid).min(1),
});

/**
 * `unit` is intentionally loose `string ≤ 30` rather than `z.enum(ALLOWED_UNITS)`
 * on both create and update.
 *
 * The "Add line item" dialog and the BOQ Excel import both clamp input to the
 * enum (via `UnitSelect` and `boqImportRowSchema` respectively), so new
 * data lands on the enum. The schemas stay loose so legacy rows whose unit
 * predates the current enum (or carries a custom string) can still be
 * edited via PATCH without forcing a backfill — the user can fix the
 * value in the UI without the API rejecting unrelated edits.
 *
 * Tighten to `z.enum(ALLOWED_UNITS)` once the data is known clean.
 */
export const createBoqItemSchema = z.object({
  sectionId: optionalUuid.nullable(),
  elementId: optionalUuid.nullable(),
  itemCode: z.string().trim().max(50).optional(),
  description: trimmedString,
  unit: trimmedString.max(30),
  quantity: quantity.optional(),
  unitCost: money.optional(),
  materialCost: money.optional().nullable(),
  labourCost: money.optional().nullable(),
  overheadPct: boqPercent.optional(),
  serviceChargePct: boqPercent.optional(),
  marginPct: boqPercent.optional(),
  // See `createElementSchema` for the rationale on these two fields.
  clientRate: money.optional().nullable(),
  budgetRate: money.optional().nullable(),
  // Per-line physical dimensions (m). Optional — only set for items
  // whose quantity is naturally L × B × H. NOT promoted to `element`
  // when the line is saved to the library (dimensions are BoQ-specific).
  length: money.optional().nullable(),
  breadth: money.optional().nullable(),
  height: money.optional().nullable(),
  notes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isProvisional: z.boolean().optional(),
  isExcluded: z.boolean().optional(),
});

export const updateBoqItemSchema = z.object({
  updatedAt: updatedAtToken,
  sectionId: z.string().uuid().nullable().optional(),
  itemCode: z.string().trim().max(50).optional(),
  description: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  quantity: quantity.optional(),
  unitCost: money.optional(),
  materialCost: money.nullable().optional(),
  labourCost: money.nullable().optional(),
  overheadPct: boqPercent.optional(),
  serviceChargePct: boqPercent.optional(),
  marginPct: boqPercent.optional(),
  clientRate: money.nullable().optional(),
  budgetRate: money.nullable().optional(),
  length: money.nullable().optional(),
  breadth: money.nullable().optional(),
  height: money.nullable().optional(),
  lifecycleStatus: z.enum(BOQ_ITEM_LIFECYCLE_STATUSES).optional(),
  clientApprovalStatus: z.enum(BOQ_ITEM_CLIENT_APPROVAL_STATUSES).optional(),
  installedQty: quantity.optional(),
  notes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isProvisional: z.boolean().optional(),
  isExcluded: z.boolean().optional(),
});

export const deleteBoqItemSchema = z.object({
  updatedAt: updatedAtToken,
});

export const reorderItemsSchema = z.object({
  sectionId: z.string().uuid().nullable(),
  orderedIds: z.array(uuid).min(1),
});

export const addElementToBoqSchema = z.object({
  sectionId: z.string().uuid().nullable(),
  elementId: uuid,
  quantity: quantity.default(1),
  rateContractItemId: z.string().uuid().optional(),
});

// ─── BOQ Excel Import (Feature 6) ───────────────────────────────────────────

/** Max accepted .xlsx size for a BOQ import. Matches the element-library cap. */
export const BOQ_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export const BOQ_IMPORT_STRATEGIES = ["append", "replace"] as const;
export type BoqImportStrategy = (typeof BOQ_IMPORT_STRATEGIES)[number];

/**
 * Wire shape of one parsed row returned to the client during preview and sent
 * back on confirm. The server re-validates against this schema on confirm —
 * never trust the first-pass parse output.
 */
export const boqImportRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  sectionTitle: z.string().trim().max(255).optional(),
  itemCode: z.string().trim().max(50).optional(),
  description: z.string().trim().min(1).max(2000),
  unit: z.enum(ALLOWED_UNITS),
  quantity: z.coerce.number().min(0).finite(),
  unitCost: z.coerce.number().min(0).finite(),
  materialCost: z.coerce.number().min(0).finite().optional(),
  labourCost: z.coerce.number().min(0).finite().optional(),
  overheadPct: z.coerce.number().min(0).max(100).optional(),
  serviceChargePct: z.coerce.number().min(0).max(100).optional(),
  marginPct: z.coerce.number().min(0).max(100).optional(),
  clientRate: z.coerce.number().min(0).finite().optional(),
  budgetRate: z.coerce.number().min(0).finite().optional(),
  length: z.coerce.number().min(0).finite().optional(),
  breadth: z.coerce.number().min(0).finite().optional(),
  height: z.coerce.number().min(0).finite().optional(),
  notes: z.string().max(2000).optional(),
  clientNotes: z.string().max(2000).optional(),
  isProvisional: z.boolean().optional(),
});

export const boqImportConfirmSchema = z.object({
  boqId: uuid,
  strategy: z.enum(BOQ_IMPORT_STRATEGIES),
  rows: z.array(boqImportRowSchema).min(1).max(5_000),
});

// ─── Vendor Management (Feature 7) ───────────────────────────────────────────

export const VENDOR_STATUSES = [
  "active",
  "inactive",
  "blacklisted",
  "pending_approval",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_PROFICIENCIES = [
  "standard",
  "specialist",
  "preferred",
] as const;
export type VendorProficiency = (typeof VENDOR_PROFICIENCIES)[number];

export const VENDOR_KYC_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type VendorKycStatus = (typeof VENDOR_KYC_STATUSES)[number];

export const VENDOR_KYC_DOCUMENT_TYPES = [
  "tax_certificate",
  "trade_licence",
  "iso_certification",
  "insurance",
  "other",
] as const;
export type VendorKycDocumentType = (typeof VENDOR_KYC_DOCUMENT_TYPES)[number];

export const vendorAddressSchema = z
  .object({
    /** Optional human label — e.g. "HQ", "Warehouse", "Billing". */
    label: z.string().max(50).optional(),
    line1: z.string().max(255).optional(),
    line2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    region: z.string().max(100).optional(),
    postal: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    /** At most one address per vendor should carry `is_primary: true`. */
    is_primary: z.boolean().optional(),
  })
  .strict();

export const vendorContactSchema = z
  .object({
    name: trimmedString.max(255),
    title: z.string().max(100).optional(),
    email: z.string().email(),
    phone: z.string().max(50).optional(),
    isPrimary: z.boolean().optional(),
    isSecondary: z.boolean().optional(),
    receivesRfq: z.boolean().optional(),
  })
  .refine((c) => !(c.isPrimary && c.isSecondary), {
    message: "A contact can't be both Main and Secondary",
    path: ["isSecondary"],
  });

export const vendorTradeSchema = z.object({
  categoryId: uuid,
  proficiencyLevel: z.enum(VENDOR_PROFICIENCIES).optional(),
  notes: z.string().max(500).optional(),
});

export const bankDetailsSchema = z
  .object({
    bank_name: z.string().max(255).optional(),
    account_holder: z.string().max(255).optional(),
    account_number: z.string().max(50).optional(),
    iban: z.string().max(50).optional(),
    swift: z.string().max(20).optional(),
    branch: z.string().max(255).optional(),
  })
  .strict();

export const createVendorSchema = z.object({
  companyName: trimmedString.max(255),
  tradingName: z.string().max(255).optional(),
  vendorCode: z.string().max(50).optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  paymentTerms: z.string().max(100).optional(),
  currency: z.string().length(3).optional(),
  vatRegistered: z.boolean().optional(),
  vatNumber: z.string().max(50).optional(),
  addresses: z.array(vendorAddressSchema).max(10).optional(),
  notes: z.string().max(2000).optional(),
  contacts: z.array(vendorContactSchema).max(20).optional(),
  trades: z.array(vendorTradeSchema).max(50).optional(),
});

/**
 * Bank details, status, and rating are excluded — they have dedicated
 * endpoints with stricter authorization.
 */
export const updateVendorSchema = z.object({
  companyName: z.string().trim().min(1).max(255).optional(),
  tradingName: z.string().max(255).optional().nullable(),
  vendorCode: z.string().max(50).optional().nullable(),
  status: z.enum(VENDOR_STATUSES).optional(),
  paymentTerms: z.string().max(100).optional().nullable(),
  currency: z.string().length(3).optional(),
  vatRegistered: z.boolean().optional(),
  vatNumber: z.string().max(50).optional().nullable(),
  addresses: z.array(vendorAddressSchema).max(10).optional(),
  notes: z.string().max(2000).optional().nullable(),
  contacts: z.array(vendorContactSchema).max(20).optional(),
  trades: z.array(vendorTradeSchema).max(50).optional(),
});

// ─── Vendor Portal — Self-Service (F8.5) ─────────────────────────────────────
//
// Vendors edit a strict subset of their own vendor record. PM-controlled
// fields (companyName, vendorCode, status, payment terms, currency, VAT,
// taxId, kyc_status, notes) are intentionally omitted — they're not in the
// schema, so a tampering client can't sneak them through.

export const vendorPortalUpdateSchema = z.object({
  tradingName: z.string().max(255).optional().nullable(),
  addresses: z.array(vendorAddressSchema).max(10).optional(),
});

export const vendorPortalContactCreateSchema = vendorContactSchema;

/**
 * Patch shape — every field is optional, and string fields accept `null` so
 * the vendor can clear an existing value (e.g. removing a phone number).
 */
export const vendorPortalContactPatchSchema = z
  .object({
    name: trimmedString.max(255).optional(),
    title: z.string().max(100).optional().nullable(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional().nullable(),
    isPrimary: z.boolean().optional(),
    isSecondary: z.boolean().optional(),
    receivesRfq: z.boolean().optional(),
  })
  .refine((c) => !(c.isPrimary && c.isSecondary), {
    message: "A contact can't be both Main and Secondary",
    path: ["isSecondary"],
  });

// ─── Vendor KYC (F7.1) ───────────────────────────────────────────────────────

export const vendorKycDocumentSchema = z.object({
  docType: z.enum(VENDOR_KYC_DOCUMENT_TYPES),
  fileUrl: trimmedString.max(2048),
  fileName: trimmedString.max(255),
  expiresAt: z.string().date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const vendorKycStatusSchema = z.object({
  kycStatus: z.enum(VENDOR_KYC_STATUSES),
  kycNotes: z.string().max(2000).optional().nullable(),
});

export const vendorRatingSchema = z.object({
  rating: z
    .number()
    .min(0)
    .max(5)
    .multipleOf(0.5, "rating must be in 0.5 increments"),
});

export const VENDOR_SORT_FIELDS = [
  "vendor_code",
  "company_name",
  "rating",
  "kyc_status",
  "updated_at",
] as const;
export type VendorSortField = (typeof VENDOR_SORT_FIELDS)[number];

export const listVendorsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  kycStatus: z.enum(VENDOR_KYC_STATUSES).optional(),
  tradeCategoryId: optionalUuid,
  sortBy: z.enum(VENDOR_SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Rate Contracts (Feature 7.5) ───────────────────────────────────────────

export const RATE_CONTRACT_STATUSES = [
  "draft",
  "active",
  "expired",
  "cancelled",
] as const;
export type RateContractStatus = (typeof RATE_CONTRACT_STATUSES)[number];

export const RATE_CONTRACT_SORT_FIELDS = [
  "contract_number",
  "name",
  "start_date",
  "end_date",
  "status",
  "updated_at",
] as const;
export type RateContractSortField = (typeof RATE_CONTRACT_SORT_FIELDS)[number];

const isoDate = z.string().date();

export const createRateContractSchema = z
  .object({
    vendorId: uuid,
    name: trimmedString.max(255),
    startDate: isoDate,
    endDate: isoDate,
    agreementSignedDate: isoDate.nullable().optional(),
    currency: z.string().length(3).optional(),
    paymentTerms: z.string().max(100).optional().nullable(),
    agreementUrl: z.string().url().max(2048).optional().nullable(),
    termsAndConditions: z.string().max(10_000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateRateContractSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    agreementSignedDate: isoDate.nullable().optional(),
    currency: z.string().length(3).optional(),
    paymentTerms: z.string().max(100).optional().nullable(),
    agreementUrl: z.string().url().max(2048).optional().nullable(),
    termsAndConditions: z.string().max(10_000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    status: z.enum(RATE_CONTRACT_STATUSES).optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const addRateContractItemsSchema = z.object({
  items: z
    .array(
      z.object({
        elementId: uuid,
        unit: z.enum(ALLOWED_UNITS),
        rate: z.number().positive(),
        notes: z.string().max(2000).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

export const listRateContractsQuerySchema = z.object({
  search: z.string().optional(),
  vendorId: optionalUuid,
  status: z.enum(RATE_CONTRACT_STATUSES).optional(),
  sortBy: z.enum(RATE_CONTRACT_SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Parse a Zod schema against the request body, returning a 400 response on failure. */
export function parseBody<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const path =
      firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : "";
    return { success: false, error: `${path}${firstError.message}` };
  }
  return { success: true, data: result.data };
}

/**
 * Safely parse JSON from a request body and validate against a Zod schema.
 * Returns `{ success: true, data }` or `{ success: false, error }`.
 * Catches malformed JSON (returns "Invalid JSON body") before running Zod validation.
 */
export async function parseRequest<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<
  { success: true; data: z.infer<T> } | { success: false; error: string }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
  return parseBody(schema, raw);
}
