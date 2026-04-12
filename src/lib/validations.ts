import { z } from "zod";

// ─── Shared constants ───────────────────────────────────────────────────────

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "completed",
  "archived",
] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
] as const;
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

// ─── Reusable primitives ────────────────────────────────────────────────────

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional();
const trimmedString = z.string().trim().min(1);
const optionalString = z.string().optional();

// ─── Tasks (/api/tasks) ─────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: trimmedString,
  description: optionalString,
  projectId: optionalUuid,
  phaseId: optionalUuid,
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assignedTo: optionalUuid,
  dueDate: z.string().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
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
  architectIds: z.array(uuid).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional().nullable(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  deadline: z.string().optional().nullable(),
  scope: z.string().optional(),
  areaSqft: z.number().optional().nullable(),
  estimationInr: z.number().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  architectIds: z.array(uuid).optional(),
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
  content: z.string().trim().min(1).max(5000),
  x_percent: z.number().min(0).max(100).optional().nullable(),
  y_percent: z.number().min(0).max(100).optional().nullable(),
  page: z.number().int().min(1).optional().nullable(),
  request_changes: z.boolean().optional(),
  assign_as_task: z
    .object({
      assigned_to: uuid,
      due_date: z.string().optional().nullable(),
    })
    .optional(),
  parent_id: optionalUuid,
});

export const updatePinSchema = z.object({
  resolved: z.boolean().optional(),
  content: z.string().trim().min(1).max(5000).optional(),
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
  content: z.string().trim().min(1).max(5000),
  phaseId: optionalUuid,
  taskId: optionalUuid,
});

// ─── Phase Tasks (/api/projects/[id]/tasks) ─────────────────────────────────

export const createPhaseTaskSchema = z.object({
  phaseId: uuid,
  title: trimmedString,
  description: optionalString,
  assignedTo: optionalUuid,
  dueDate: z.string().optional().nullable(),
});

export const updatePhaseTaskSchema = z.object({
  taskId: uuid,
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(PHASE_TASK_STATUSES).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
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

/** Safely parse JSON from a request body and validate against a Zod schema.
 *  Returns `{ success: true, data }` or `{ success: false, error }`.
 *  Catches malformed JSON (returns "Invalid JSON body") before running Zod validation. */
export async function parseRequest<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
  return parseBody(schema, raw);
}
