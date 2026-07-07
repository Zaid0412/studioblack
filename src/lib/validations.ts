import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "@/lib/constants";
import { MAX_UPLOAD_SIZE } from "@/lib/fileUtils";

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

/**
 * Per-item lifecycle phase — the unified replacement for the old
 * (lifecycle_status, client_approval_status) pair. Drives the single badge
 * shown in the table and the bulk lifecycle picker.
 */
export const BOQ_ITEM_PHASES = [
  "draft",
  "internal_review",
  "internal_changes_requested",
  "internally_approved",
  "sent_to_client",
  "client_reviewing",
  "client_changes_requested",
  "client_approved",
  // RFQ-4a: PM marks a client-approved item ready to enter an RFQ. Only items
  // in this phase are eligible for RFQ. PM-only forward transition.
  "ready_for_procurement",
] as const;
export type BoqItemPhase = (typeof BOQ_ITEM_PHASES)[number];

/**
 * Allowed phase transitions. Any other src→dst pair is rejected at the route
 * layer.
 *
 * Two kick-back states exist: `internal_changes_requested` (PM kicks back
 * during internal review OR pulls back an item already visible to the
 * client) and `client_changes_requested` (client kicks back during review).
 * Both exit to `draft` so the creator reworks and the item walks the chain
 * again. From either kick-back state the creator can also jump straight
 * back to `internal_review` once the fix is in — saves a click versus the
 * draft → internal_review path, and (for `client_changes_requested`)
 * keeps the PM in the loop instead of letting an architect re-send to
 * the client without a second pair of eyes.
 *
 * `client_reviewing` is auto-set at the read path the first time a client
 * opens the BOQ — items sitting in `sent_to_client` flip to `client_reviewing`
 * before the SELECT returns. No role can fire it manually (see
 * `phasePermissions.ts`).
 *
 * PM "pull-back": from any client-visible phase (`sent_to_client`,
 * `client_reviewing`, `client_changes_requested`, `client_approved`) the PM
 * can fire `internal_changes_requested`, which drops the row out of
 * `CLIENT_VISIBLE_PHASES` so the client loses sight of it on next refetch.
 */
export const BOQ_ITEM_PHASE_TRANSITIONS: Record<BoqItemPhase, BoqItemPhase[]> =
  {
    draft: ["internal_review"],
    internal_review: [
      "internally_approved",
      "internal_changes_requested",
      "draft",
    ],
    internal_changes_requested: ["draft", "internal_review"],
    internally_approved: [
      "sent_to_client",
      "internal_changes_requested",
      "draft",
    ],
    sent_to_client: ["client_reviewing", "internal_changes_requested"],
    client_reviewing: [
      "client_approved",
      "client_changes_requested",
      "internal_changes_requested",
    ],
    // `client_approved` is the undo path: if the client hit Request Changes
    // by accident (or changes their mind), they can flip straight to
    // approved without waiting for the studio to bounce it through draft.
    client_changes_requested: [
      "draft",
      "internal_review",
      "client_approved",
      "internal_changes_requested",
    ],
    client_approved: [
      "ready_for_procurement",
      "client_changes_requested",
      "internal_changes_requested",
    ],
    // Forward path is procurement (po_status, not a phase). Manual exit is a PM
    // pull-back to internal changes; a material edit auto-flips it to
    // sent_to_client (re-approval) — see updateBoqItem.
    ready_for_procurement: ["internal_changes_requested"],
  };

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
  pmIds: z.array(z.string().min(1)).optional(),
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
  /** PM membership list. Min length enforced at route level (1+) for non-empty syncs. */
  pmIds: z.array(z.string().min(1)).optional(),
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

const pct = z.number().min(0).max(100);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const shapeStyleFields = {
  color: hexColor,
  strokeWidth: z.number().int().min(1).max(10),
  opacity: z.number().gt(0).max(1),
  fill: z.boolean(),
};

/**
 * Shape geometry + style discriminated by `type`. All coords are
 * percent-based so shapes survive viewer zoom / resolution changes. Each
 * shape carries its own style so a comment can mix e.g. a red rectangle and
 * a blue circle.
 */
export const pinShapeSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("rectangle"),
      x: pct,
      y: pct,
      w: pct,
      h: pct,
      ...shapeStyleFields,
    })
    // The client filters zero-extent shapes via MIN_EXTENT_PCT, but a tampering
    // client can still post `w: 0, h: 0` — reject the invisible shape here.
    .refine((s) => s.w > 0 || s.h > 0, {
      message: "rectangle must have non-zero width or height",
    }),
  z
    .object({
      type: z.literal("circle"),
      cx: pct,
      cy: pct,
      rx: pct,
      ry: pct,
      ...shapeStyleFields,
    })
    .refine((s) => s.rx > 0 || s.ry > 0, {
      message: "circle must have non-zero rx or ry",
    }),
  z.object({
    type: z.literal("freehand"),
    points: z
      .array(z.tuple([pct, pct]))
      .min(2)
      .max(500),
    ...shapeStyleFields,
  }),
]);

/** Cap on shapes per comment — large enough that real usage never hits it. */
export const MAX_SHAPES_PER_PIN = 20;

export const createPinSchema = z.object({
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
  x_percent: pct.optional().nullable(),
  y_percent: pct.optional().nullable(),
  page: z.number().int().min(1).optional().nullable(),
  request_changes: z.boolean().optional(),
  assign_as_task: z
    .object({
      assigned_to: userId,
      due_date: z.string().optional().nullable(),
    })
    .optional(),
  parent_id: optionalUuid,
  shapes: z.array(pinShapeSchema).max(MAX_SHAPES_PER_PIN).optional(),
});

export const updatePinSchema = z.object({
  resolved: z.boolean().optional(),
  content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH).optional(),
  x_percent: pct.optional(),
  y_percent: pct.optional(),
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
  codePrefix: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const updateElementCategorySchema = z.object({
  name: trimmedString.max(150).optional(),
  codePrefix: z.string().max(20).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

const bulkCategoryBase = z.object({
  name: trimmedString.max(150),
  codePrefix: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

// Level 3 (service area) — leaf, no children.
const bulkCategoryL3 = bulkCategoryBase;
// Level 2 (sub-category) — may hold service areas.
const bulkCategoryL2 = bulkCategoryBase.extend({
  children: z.array(bulkCategoryL3).max(200).optional(),
});
// Level 1 (category) — may hold sub-categories.
const bulkCategoryNode = bulkCategoryBase.extend({
  children: z.array(bulkCategoryL2).max(200).optional(),
});

export const bulkCreateCategoriesSchema = z.object({
  categories: z.array(bulkCategoryNode).min(1).max(50),
});

export type BulkCategoryNode = z.infer<typeof bulkCategoryNode>;

export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  orderedIds: z.array(uuid).min(1),
});

// ─── Elements (/api/elements) ───────────────────────────────────────────────

export const ALLOWED_UNITS = [
  "m2",
  "sqft",
  "m3",
  "cuft",
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
/**
 * Per-line physical dimension validator (m). Capped at 9_999_999 because
 * the DB column is `NUMERIC(10,3)` — anything larger overflows on insert.
 * Hitting the cap with a Zod error is a friendlier failure mode than the
 * raw pg overflow message.
 */
const dimension = z.coerce.number().min(0).max(9_999_999).finite();
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
});

/** Phases that require a non-empty `comment` from the actor. */
const PHASES_REQUIRING_COMMENT: readonly BoqItemPhase[] = [
  "internal_changes_requested",
  "client_changes_requested",
];

/**
 * BOQ phases eligible to enter an RFQ (RFQ-4a): the PM must explicitly mark an
 * item `ready_for_procurement` — client approval alone isn't enough, so the PM
 * controls when sourcing starts. Shared by the server-side eligibility gate and
 * the client-side item picker so the two can't drift apart.
 */
export const RFQ_ELIGIBLE_PHASES: readonly BoqItemPhase[] = [
  "ready_for_procurement",
];

/**
 * Move a single item to a new phase. `comment` is optional except when the
 * target is a kick-back (`*_changes_requested`) — the creator needs to know
 * what to fix.
 */
export const setItemPhaseSchema = z
  .object({
    phase: z.enum(BOQ_ITEM_PHASES),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) =>
      !PHASES_REQUIRING_COMMENT.includes(v.phase) ||
      (v.comment !== undefined && v.comment.length > 0),
    {
      message: "Comment is required when requesting changes.",
      path: ["comment"],
    }
  );

/** Bulk variant: same target phase applied to every listed item. */
export const setItemsPhaseSchema = z
  .object({
    itemIds: z.array(uuid).min(1).max(500),
    phase: z.enum(BOQ_ITEM_PHASES),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) =>
      !PHASES_REQUIRING_COMMENT.includes(v.phase) ||
      (v.comment !== undefined && v.comment.length > 0),
    {
      message: "Comment is required when requesting changes.",
      path: ["comment"],
    }
  );

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
  name: z.string().trim().max(255).nullable().optional(),
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
  length: dimension.optional().nullable(),
  breadth: dimension.optional().nullable(),
  height: dimension.optional().nullable(),
  dimensionUnit: z.enum(["m", "ft"]).optional(),
  notes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isProvisional: z.boolean().optional(),
  isExcluded: z.boolean().optional(),
});

/**
 * Why a BOQ item's qty/spec/cost changed. Auto-derived from the edited fields
 * when the caller doesn't supply one (quantity-only → `quantity`, spec/unit →
 * `specification`, else `other`); `scope_add`/`scope_remove` are reserved for
 * the RFQ-3c impact flow (item added to / removed from scope).
 */
export const BOQ_ITEM_CHANGE_REASONS = [
  "quantity",
  "specification",
  "scope_add",
  "scope_remove",
  "other",
] as const;
export type BoqItemChangeReason = (typeof BOQ_ITEM_CHANGE_REASONS)[number];

export const updateBoqItemSchema = z.object({
  updatedAt: updatedAtToken,
  sectionId: z.string().uuid().nullable().optional(),
  itemCode: z.string().trim().max(50).optional(),
  name: z.string().trim().max(255).nullable().optional(),
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
  length: dimension.nullable().optional(),
  breadth: dimension.nullable().optional(),
  height: dimension.nullable().optional(),
  dimensionUnit: z.enum(["m", "ft"]).optional(),
  installedQty: quantity.optional(),
  notes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isProvisional: z.boolean().optional(),
  isExcluded: z.boolean().optional(),
  // Provenance for the change-version snapshot (RFQ-3a). Both optional — when a
  // material field is edited without a reason, the query auto-derives one.
  changeReason: z.enum(BOQ_ITEM_CHANGE_REASONS).optional(),
  changeNote: z.string().trim().max(2000).nullable().optional(),
});

export const deleteBoqItemSchema = z.object({
  updatedAt: updatedAtToken,
});

/** Apply an active rate-contract rate to an existing BOQ item. */
export const applyRateToBoqItemSchema = z.object({
  rateContractItemId: uuid,
  updatedAt: updatedAtToken,
});

/** Batch check: which of these elements have an active matching rate contract. */
export const boqRateAvailabilitySchema = z.object({
  elementIds: z.array(uuid).min(1).max(200),
});

export const moveBoqItemSchema = z.object({
  updatedAt: updatedAtToken,
  /** `null` moves the item back to the Unassigned bucket. */
  targetSectionId: uuid.nullable(),
});

export const bulkMoveBoqItemsSchema = z.object({
  /** Items receive successive sort_order values starting at MAX+1 of the target bucket, in this order. */
  itemIds: z.array(uuid).min(1).max(500),
  /** `null` moves them all to the Unassigned bucket. */
  targetSectionId: uuid.nullable(),
});

export const bulkDeleteBoqItemsSchema = z.object({
  itemIds: z.array(uuid).min(1).max(500),
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

/**
 * Batch variant — one section, N elements each with their own quantity.
 * Backs the multi-select element picker. Capped at 50 entries per call;
 * the UI's checkbox surface shouldn't realistically hit that.
 */
export const addElementsToBoqSchema = z.object({
  sectionId: z.string().uuid().nullable(),
  items: z
    .array(
      z.object({
        elementId: uuid,
        quantity: quantity.default(1),
        rateContractItemId: z.string().uuid().optional(),
      })
    )
    .min(1)
    .max(50),
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
  length: dimension.optional(),
  breadth: dimension.optional(),
  height: dimension.optional(),
  dimensionUnit: z.enum(["m", "ft"]).optional(),
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
    /** India IFSC code (11 chars). Kept loose at 20 to tolerate variants. */
    ifsc_code: z.string().max(20).optional(),
    branch: z.string().max(255).optional(),
  })
  .strict();

/** Capped at 50 × 100 chars to keep payloads bounded; DB type is `text[]`. */
const VENDOR_FREE_TEXT_ARRAY = z.array(trimmedString.max(100)).max(50);

export const createVendorSchema = z.object({
  companyName: trimmedString.max(255),
  tradingName: z.string().max(255).optional(),
  vendorCode: z.string().max(50).optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  paymentTerms: z.string().max(100).optional(),
  currency: z.string().length(3).optional(),
  vatRegistered: z.boolean().optional(),
  vatNumber: z.string().max(50).optional(),
  gstin: z.string().max(20).optional(),
  website: z.string().url().max(500).optional(),
  preferredVendor: z.boolean().optional(),
  brandsSupported: VENDOR_FREE_TEXT_ARRAY.optional(),
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
  gstin: z.string().max(20).optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  preferredVendor: z.boolean().optional(),
  brandsSupported: VENDOR_FREE_TEXT_ARRAY.optional(),
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
  /** Restrict the list to vendors flagged `preferred_vendor = true`. */
  preferred: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
  sortBy: z.enum(VENDOR_SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Rate Contracts (Feature 7.5) ───────────────────────────────────────────

// Keep in sync with the DB CHECK in
// scripts/migrate-rate-contract-status-workflow.sql.
export const RATE_CONTRACT_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "active",
  "suspended",
  "expired",
  "closed",
  "cancelled",
] as const;
export type RateContractStatus = (typeof RATE_CONTRACT_STATUSES)[number];

/** Lifecycle actions that move a rate contract between statuses. */
export const RATE_CONTRACT_ACTIONS = [
  "submit",
  "approve",
  "request_changes",
  "activate",
  "suspend",
  "resume",
  "close",
  "cancel",
] as const;
export type RateContractAction = (typeof RATE_CONTRACT_ACTIONS)[number];

/**
 * A column write applied alongside the status change. `now` → `now()`,
 * `clear` → `NULL`, `actor` → the acting user's id. The column is a fixed
 * literal (never user input), so it's safe to interpolate into SQL.
 */
type RateContractEffect =
  | { col: "submitted_at"; op: "now" | "clear" }
  | { col: "approved_by"; op: "actor" }
  | { col: "approved_at"; op: "now" }
  | { col: "review_note"; op: "note" | "clear" };

interface RateContractTransition {
  /** Statuses this action may be applied from. */
  from: readonly RateContractStatus[];
  /** Status the contract moves to. */
  to: RateContractStatus;
  /** Requires the org-owner/admin ("pm") effective role — architects can't. */
  pmOnly?: boolean;
  /** Requires at least one item on the contract. */
  requiresItems?: boolean;
  /** Approval-metadata writes applied with the transition. */
  effects?: readonly RateContractEffect[];
}

/**
 * The rate-contract state machine. Single source of truth for both the server
 * (transitionRateContract) and the UI (which actions to offer). Auto-expiry
 * (`active → expired`) is handled separately by the date sweep, not an action.
 */
export const RATE_CONTRACT_TRANSITIONS: Record<
  RateContractAction,
  RateContractTransition
> = {
  submit: {
    from: ["draft"],
    to: "under_review",
    // Clear any prior reviewer note on re-submission.
    effects: [
      { col: "submitted_at", op: "now" },
      { col: "review_note", op: "clear" },
    ],
  },
  approve: {
    from: ["under_review"],
    to: "approved",
    pmOnly: true,
    effects: [
      { col: "approved_by", op: "actor" },
      { col: "approved_at", op: "now" },
    ],
  },
  request_changes: {
    from: ["under_review"],
    to: "draft",
    pmOnly: true,
    effects: [
      { col: "submitted_at", op: "clear" },
      { col: "review_note", op: "note" },
    ],
  },
  activate: { from: ["approved"], to: "active", requiresItems: true },
  suspend: { from: ["active"], to: "suspended" },
  resume: { from: ["suspended"], to: "active" },
  close: { from: ["active"], to: "closed" },
  cancel: {
    from: ["draft", "under_review", "approved", "active", "suspended"],
    to: "cancelled",
  },
};

export const transitionRateContractSchema = z.object({
  action: z.enum(RATE_CONTRACT_ACTIONS),
  /** Optional reviewer message — stored when the action is `request_changes`. */
  note: z.string().max(2000).optional().nullable(),
});

export const RATE_CONTRACT_TYPES = [
  "material",
  "labor",
  "equipment",
  "subcontract",
  "mixed",
] as const;
export type RateContractType = (typeof RATE_CONTRACT_TYPES)[number];

export const RATE_CONTRACT_PRICE_BASES = ["supply", "supply_install"] as const;
export type RateContractPriceBasis = (typeof RATE_CONTRACT_PRICE_BASES)[number];

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
    contractType: z.enum(RATE_CONTRACT_TYPES).optional().nullable(),
    creditPeriodDays: z.number().int().min(0).max(3650).optional().nullable(),
    deliveryTerms: z.string().max(100).optional().nullable(),
    priceBasis: z.enum(RATE_CONTRACT_PRICE_BASES).optional().nullable(),
    renewalDate: isoDate.optional().nullable(),
    projectId: z.string().uuid().nullable().optional(),
    taxIncluded: z.boolean().optional(),
    taxPercentage: z.number().min(0).max(100).optional().nullable(),
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
    // status is not editable here — it moves only through the transition
    // state machine (POST /[id]/transition).
    contractType: z.enum(RATE_CONTRACT_TYPES).optional().nullable(),
    creditPeriodDays: z.number().int().min(0).max(3650).optional().nullable(),
    deliveryTerms: z.string().max(100).optional().nullable(),
    priceBasis: z.enum(RATE_CONTRACT_PRICE_BASES).optional().nullable(),
    renewalDate: isoDate.optional().nullable(),
    projectId: z.string().uuid().nullable().optional(),
    taxIncluded: z.boolean().optional(),
    taxPercentage: z.number().min(0).max(100).optional().nullable(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const addRateContractItemsSchema = z.object({
  items: z
    .array(
      z
        .object({
          categoryId: uuid,
          elementId: optionalUuid,
          unit: z.enum(ALLOWED_UNITS),
          rate: z.number().positive(),
          notes: z.string().max(2000).optional().nullable(),
          description: z.string().max(2000).optional().nullable(),
          minQty: z.number().min(0).optional().nullable(),
          maxQty: z.number().min(0).optional().nullable(),
          leadTimeDays: z.number().int().min(0).max(3650).optional().nullable(),
          validUntil: isoDate.optional().nullable(),
          taxPct: z.number().min(0).max(100).optional().nullable(),
        })
        .refine(
          (d) => d.minQty == null || d.maxQty == null || d.maxQty >= d.minQty,
          { message: "maxQty must be >= minQty", path: ["maxQty"] }
        )
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

// ─── RFQ (F9) ───────────────────────────────────────────────────────────────

export const RFQ_STATUSES = [
  "draft",
  "issued",
  "quotes_received",
  "under_review",
  "awarded",
  "cancelled",
  // Replaced by a revision (RFQ-3b). Terminal: every mutation guard whitelists
  // other statuses, so a superseded RFQ is read-only by construction.
  "superseded",
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

/** Terminal statuses — no further edits, cancel, issue, or award. */
export const RFQ_TERMINAL_STATUSES = [
  "awarded",
  "cancelled",
  "superseded",
] as const;

/** Statuses from which a scope change can raise a revision (RFQ-3b). */
export const RFQ_REVISABLE_STATUSES = [
  "issued",
  "quotes_received",
  "under_review",
  "awarded",
] as const;
/** Status set where more vendors can be invited after the initial issue. */
export const RFQ_INVITEABLE_STATUSES = [
  "issued",
  "quotes_received",
  "under_review",
] as const;

export const listRfqsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(RFQ_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

const rfqItemInputSchema = z.object({
  boqItemId: z.string().uuid(),
  description: z.string().trim().min(1).max(2000),
  unit: z.string().trim().min(1).max(30),
  quantity: z.coerce.number().positive().finite(),
  specNotes: z.string().trim().max(2000).optional().nullable(),
});

/** PRD §9 RFQ "Package Type" (Material / Labor / Mixed). */
export const RFQ_PACKAGE_TYPES = ["material", "labor", "mixed"] as const;
export type RfqPackageType = (typeof RFQ_PACKAGE_TYPES)[number];

export const createRfqSchema = z.object({
  title: z.string().trim().min(1).max(255),
  packageType: z.enum(RFQ_PACKAGE_TYPES).optional().nullable(),
  scopeOfWork: z.string().trim().max(MAX_CONTENT_LENGTH).optional().nullable(),
  termsConditions: z
    .string()
    .trim()
    .max(MAX_CONTENT_LENGTH)
    .optional()
    .nullable(),
  responseDeadline: z.string().date().optional().nullable(),
  items: z.array(rfqItemInputSchema).min(1).max(500),
});

/**
 * Patch shape for a draft RFQ header. Items are not edited via this schema —
 * Phase C will add explicit item add/remove endpoints. Once a RFQ leaves
 * `draft`, the route returns 409.
 */
export const updateRfqSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    packageType: z.enum(RFQ_PACKAGE_TYPES).nullable().optional(),
    scopeOfWork: z
      .string()
      .trim()
      .max(MAX_CONTENT_LENGTH)
      .nullable()
      .optional(),
    termsConditions: z
      .string()
      .trim()
      .max(MAX_CONTENT_LENGTH)
      .nullable()
      .optional(),
    responseDeadline: z.string().date().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No fields to update",
  });

export const issueRfqSchema = z.object({
  vendorIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Same shape as issueRfqSchema — exported separately so callers can read
 * the intent at the import site (and so we can diverge later if needed).
 */
export const inviteRfqVendorsSchema = z.object({
  vendorIds: z.array(z.string().uuid()).min(1).max(50),
});

export const addRfqItemsSchema = z.object({
  items: z.array(rfqItemInputSchema).min(1).max(500),
});

export const cancelRfqSchema = z.object({
  reason: z.string().trim().max(2000).optional().nullable(),
});

export const reviseRfqSchema = z.object({
  reason: z.string().trim().max(2000).optional().nullable(),
});

// ─── Vendor Quotes (F10) ────────────────────────────────────────────────────

export const VENDOR_QUOTE_STATUSES = [
  "submitted",
  "under_review",
  "awarded",
  "rejected",
  "expired",
] as const;
export type VendorQuoteStatus = (typeof VENDOR_QUOTE_STATUSES)[number];

/** RFQ statuses where a vendor can still submit / revise a quote. */
export const QUOTE_SUBMITTABLE_RFQ_STATUSES = [
  "issued",
  "quotes_received",
  "under_review",
] as const;

/** RFQ statuses where an architect can award. */
export const QUOTE_AWARDABLE_RFQ_STATUSES = [
  "quotes_received",
  "under_review",
] as const;

const submitQuoteItemSchema = z.object({
  rfqItemId: z.string().uuid(),
  unitPrice: z.coerce.number().nonnegative().finite(),
  notes: z.string().trim().max(2000).optional().nullable(),
  alternativeSpec: z.string().trim().max(2000).optional().nullable(),
});

export const QUOTE_CURRENCIES = ["USD", "EUR", "TRY", "GBP", "INR"] as const;
export type QuoteCurrency = (typeof QUOTE_CURRENCIES)[number];

/**
 * Base attachment reference — a file the client points us at (already uploaded
 * to storage). Used for §11 per-line RFQ docs and as the base for §15 evidence.
 */
export const quoteAttachmentSchema = z.object({
  url: z.string().url().max(2048),
  fileName: z.string().trim().min(1).max(255),
});
export type QuoteAttachmentInput = z.infer<typeof quoteAttachmentSchema>;

/**
 * Quote evidence (§15). The client supplies only the file + descriptive fields;
 * `uploadedBy` / `uploadedAt` / `source` are server-stamped and intentionally
 * absent here so a client can't forge provenance.
 */
export const quoteEvidenceSchema = quoteAttachmentSchema.extend({
  fileType: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type QuoteEvidenceInput = z.infer<typeof quoteEvidenceSchema>;

export const submitQuoteSchema = z.object({
  validUntil: z.string().date().optional().nullable(),
  currency: z.enum(QUOTE_CURRENCIES).default("USD"),
  deliveryPeriod: z.string().trim().max(100).optional().nullable(),
  paymentTerms: z.string().trim().max(100).optional().nullable(),
  inclusions: z.string().trim().max(MAX_CONTENT_LENGTH).optional().nullable(),
  exclusions: z.string().trim().max(MAX_CONTENT_LENGTH).optional().nullable(),
  notes: z.string().trim().max(MAX_CONTENT_LENGTH).optional().nullable(),
  items: z.array(submitQuoteItemSchema).min(1).max(500),
  attachments: z.array(quoteEvidenceSchema).max(20).optional().default([]),
});

/** How a quote reached us. `portal` = vendor self-service; the rest PM-recorded. */
export const RFQ_RESPONSE_SOURCES = [
  "portal",
  "email",
  "whatsapp",
  "phone",
  "pdf",
  "excel",
  "manual",
] as const;
export type RfqResponseSource = (typeof RFQ_RESPONSE_SOURCES)[number];

/** Sources a PM can pick when recording a quote received off-portal. */
export const RFQ_MANUAL_RESPONSE_SOURCES = [
  "email",
  "whatsapp",
  "phone",
  "pdf",
  "excel",
  "manual",
] as const;
export type RfqManualResponseSource =
  (typeof RFQ_MANUAL_RESPONSE_SOURCES)[number];

/**
 * How an RFQ was distributed to a vendor (§11). `email` = the issue fan-out
 * reached a `receives_rfq` contact; `portal` = invited but portal-only.
 * `whatsapp`/`manual` are recorded post-issue via the §17 communication log.
 * Matches the `rfq_vendor.distribution_method` CHECK constraint.
 */
export const RFQ_DISTRIBUTION_METHODS = [
  "portal",
  "email",
  "whatsapp",
  "manual",
] as const;
export type RfqDistributionMethod = (typeof RFQ_DISTRIBUTION_METHODS)[number];

/**
 * PRD §17: log a manual, off-system communication against an RFQ (channel +
 * remarks). Excludes `portal` — that's vendor self-service, not a manual log.
 */
export const logRfqCommunicationSchema = z.object({
  channel: z.enum(RFQ_MANUAL_RESPONSE_SOURCES),
  vendorId: z.string().uuid().nullable().optional(),
  remarks: z.string().trim().min(1).max(2000),
});

/** PRD §11: per-line RFQ attachments (spec drawings / reference docs). */
export const updateRfqItemAttachmentsSchema = z.object({
  attachments: z.array(quoteAttachmentSchema).max(20),
});

/**
 * A PM records a quote received off-channel on behalf of an already-invited
 * vendor. Reuses the vendor submit shape + who/how/when it arrived + evidence.
 */
export const enterQuoteSchema = submitQuoteSchema.extend({
  vendorId: z.string().uuid(),
  responseSource: z.enum(RFQ_MANUAL_RESPONSE_SOURCES),
  receivedDate: z.string().date(),
  // `attachments` (evidence) is inherited from submitQuoteSchema.
});

export const awardRfqSingleSchema = z.object({
  quoteId: z.string().uuid(),
});

export const awardRfqSplitSchema = z.object({
  awards: z
    .array(
      z.object({
        rfqItemId: z.string().uuid(),
        quoteItemId: z.string().uuid(),
      })
    )
    .min(1)
    .max(500),
});

// ─── Project Documents ──────────────────────────────────────────────────────

/** Lucide icon name — PascalCase, matching lucide-react's `icons` export. */
const lucideIcon = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Z][A-Za-z0-9]*$/, "must be a PascalCase lucide icon name");

export const createDocumentSectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: lucideIcon.optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateDocumentSectionSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  icon: lucideIcon.optional(),
  position: z.number().int().min(0).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

/**
 * Shared body for both upload-url routes — the section-level one and the
 * per-document new-version one. Storage-path generation and the bytes-PUT
 * step are identical between the two flows.
 */
export const documentUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE),
});

export const createDocumentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE),
  mimeType: z.string().trim().min(1).max(150),
  storagePath: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).nullable().optional(),
});

/**
 * PATCH /api/projects/:id/documents/:docId — rename, edit description, or move
 * to a different section. All keys optional; at least one must be present.
 * `description` accepts an empty string to clear the field.
 */
export const updateDocumentSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    sectionId: z.string().uuid().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be supplied",
  });

/** POST /api/projects/:id/documents/:docId/revert */
export const revertDocumentSchema = z.object({
  targetVersion: z.number().int().positive(),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Parse a Zod schema against the request body, returning a 400 response on failure. */
export function parseBody<T extends z.ZodType>(
  schema: T,
  data: unknown
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; field?: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues[0];
    // `field` is the dotted path of the offending input (e.g. "website",
    // "contacts.0.email") so clients can flag it inline; `error` keeps the
    // path-prefixed form for backward-compatible toasts.
    const field = firstError.path.length
      ? firstError.path.join(".")
      : undefined;
    const prefix = field ? `${field}: ` : "";
    return { success: false, error: `${prefix}${firstError.message}`, field };
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
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; field?: string }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
  return parseBody(schema, raw);
}
