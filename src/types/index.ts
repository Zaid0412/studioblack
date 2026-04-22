import type {
  TaskStatus,
  TaskPriority,
  TaskCategory,
  BoqStatus,
  BoqItemLifecycleStatus,
  BoqItemClientApprovalStatus,
  BoqItemPoStatus,
} from "@/lib/validations";

/** Roles available to authenticated users. */
export type UserRole = "pm" | "architect" | "client";

/** A registered user in the platform. */
export interface User {
  /** Unique identifier. */
  id: string;
  /** Full display name. */
  name: string;
  /** Email address used for login and notifications. */
  email: string;
  /** Determines sidebar layout and accessible routes. */
  role: UserRole;
  /** Optional URL to a profile image. Falls back to {@link initials}. */
  avatar?: string;
  /** 1-2 character abbreviation rendered inside the Avatar component. */
  initials: string;
}

/** Lifecycle stages of an architectural project. */
export type ProjectStatus = "draft" | "active" | "completed" | "archived";

/** Architectural project categories. */
export type ProjectCategory =
  | "residential"
  | "commercial"
  | "healthcare"
  | "hospitality"
  | "institutional"
  | "retail"
  | "workspace";

/**
 * Approval pipeline stages for a single design deliverable.
 *
 * Flow: draft → submitted → in-review → approved-arch → approved-client
 * (changes-requested can occur from in-review or later)
 */
export type DesignStatus =
  | "draft"
  | "submitted"
  | "in-review"
  | "approved-arch"
  | "approved-client"
  | "changes-requested";

/** An in-app notification shown in the notification centre. */
export interface Notification {
  id: string;
  /** Short headline shown in the notification list. */
  title: string;
  /** Longer explanatory text. */
  description: string;
  /** Category used to pick the icon and colour in the UI. */
  type:
    | "review"
    | "comment"
    | "approval"
    | "upload"
    | "deadline"
    | "team"
    | "invitation"
    | "task_assigned"
    | "review_requested"
    | "review_submitted";
  /** Whether the user has already seen this notification. */
  read: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Optional link to the related project. */
  projectId?: string;
}

// ---------------------------------------------------------------------------
// DB-facing types (used by dashboard pages)
// ---------------------------------------------------------------------------

/** Attachment record from the database. */
export interface DbAttachment {
  id: string;
  file_url: string;
  file_name: string;
  description: string;
  phase_id: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  version?: number;
  version_group?: string;
  review_status?: string;
  frozen_at?: string | null;
  sent_to_client_at?: string | null;
  sent_to_client_by?: string | null;
  reviewed_by_name?: string | null;
  versions?: DbAttachment[];
}

/** Comment record from the database. */
export interface DbComment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

/** Phase record from the database. */
export interface DbPhase {
  id: string;
  name: string;
  phase_order: number;
  status?: string;
}

/** Workflow step record. */
export interface DbStep {
  id: string;
  name: string;
  step_order: number;
  status: string;
}

/** Project team member record. */
export interface DbMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

/** Full project detail from the API. */
export interface DbProjectDetail {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: string;
  deadline: string | null;
  scope: string | null;
  area_sqft: number | null;
  estimation_inr: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  phases: DbPhase[];
  members: DbMember[];
  steps?: DbStep[];
}

/** Project row from the projects list API. */
export interface DbProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: ProjectStatus;
  deadline: string | null;
  scope: string | null;
  area_sqft: number | null;
  estimation_inr: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at?: string;
  architect_ids: string[] | null;
}

/** Organisation member from better-auth. */
export interface OrgMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

/** Organisation invitation from better-auth. */
export interface OrgInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
}

/** A single review round on an attachment (like a GitHub PR review). */
export interface DbAttachmentReview {
  id: string;
  attachment_id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: "approved" | "rejected";
  comment: string;
  annotated_file_url: string | null;
  annotation_count: number;
  created_at: string;
}

/** A pin comment placed on an attachment at a specific position. */
export interface DbPinComment {
  id: string;
  attachment_id: string;
  user_id: string;
  user_name: string;
  x_percent: number | null;
  y_percent: number | null;
  page: number | null;
  content: string;
  resolved: boolean;
  task_id: string | null;
  request_approval: boolean;
  request_changes: boolean;
  parent_id: string | null;
  updated_at: string | null;
  reply_count: number;
  created_at: string;
}

/** DB notification row from the notifications API. */
export interface DbNotificationRow {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
}

// ---------------------------------------------------------------------------
// Approval & pending task types (client portal)
// ---------------------------------------------------------------------------

/** A project-level approval decision (approve or request changes). */
export interface DbApproval {
  id: string;
  decision: "approved" | "changes_requested";
  comment: string;
  user_name: string;
  created_at: string;
}

/** A task awaiting client review. */
export interface DbPendingTask {
  id: string;
  title: string;
  description: string;
  phase_name: string;
  assigned_name: string | null;
  review_status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Task manager types
// ---------------------------------------------------------------------------

export type { TaskStatus, TaskPriority, TaskCategory };

export interface Task {
  id: string;
  org_id: string;
  project_id: string | null;
  phase_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name: string | null;
  created_by_name: string;
  project_name: string | null;
  phase_name: string | null;
  is_starred: boolean;
  checklist_total: number;
  checklist_done: number;
  /** Set when the task was created from a pin comment. */
  pin_comment_id: string | null;
  /** The attachment the pin comment belongs to. */
  pin_attachment_id: string | null;
}

/** A single checklist item on a task. */
export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

/** A file attached to a standalone task. */
export interface TaskAttachment {
  id: string;
  standalone_task_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  projectId?: string;
  phaseId: string;
  priority: string;
  category: string;
  assignedTo: string;
  dueDate: string;
  /** Checklist items to create alongside the task (create mode only). */
  checklistItems: string[];
  /** Files to upload and attach after task creation (create mode only). Client-only — uses browser File API. */
  pendingFiles: globalThis.File[];
}

// ---------------------------------------------------------------------------
// Element Library types
// ---------------------------------------------------------------------------

/** A single element category row from the DB. */
export interface ElementCategory {
  id: string;
  org_id: string;
  name: string;
  parent_id: string | null;
  level: 1 | 2 | 3;
  code_prefix: string | null;
  sort_order: number;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Present when loaded via `getCategoryTree` — direct element count (archived included). */
  element_count?: number;
}

/** Recursive tree node for nested category display. */
export interface ElementCategoryNode extends ElementCategory {
  children: ElementCategoryNode[];
}

/**
 * A construction element row.
 * Numeric fields arrive from `pg` as strings (NUMERIC type) — format on display.
 */
export interface Element {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  unit_cost: string;
  currency: string;
  material_cost: string | null;
  labour_cost: string | null;
  overhead_pct: string | null;
  margin_pct: string | null;
  spec_reference: string | null;
  drawing_ref: string | null;
  tags: string[] | null;
  is_active: boolean;
  version_group: string;
  version_number: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Free-form attribute attached to an element (e.g., "Finish": "Matte"). */
export interface ElementAttribute {
  id: string;
  element_id: string;
  attribute_key: string;
  attribute_value: string;
  unit: string | null;
  sort_order: number;
}

/** Element enriched with attributes + category breadcrumb for detail views. */
export interface ElementWithDetails extends Element {
  attributes: ElementAttribute[];
  category_path: string[] | null;
}

// ---------------------------------------------------------------------------
// BOQ (Bill of Quantities) — Feature 4
// ---------------------------------------------------------------------------

/** A Bill of Quantities header row. One BOQ per project (for now). */
export interface Boq {
  id: string;
  project_id: string;
  title: string;
  version: number;
  status: BoqStatus;
  currency: string;
  exchange_rate: string;
  contingency_pct: string;
  vat_pct: string;
  minimum_margin_pct: string;
  client_id: string | null;
  architect_id: string | null;
  issued_date: string | null;
  approved_date: string | null;
  notes: string | null;
  client_notes: string | null;
  snapshot: unknown | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A section grouping within a BOQ (e.g., "Civil", "Electrical"). */
export interface BoqSection {
  id: string;
  boq_id: string;
  title: string;
  sort_order: number;
  description: string | null;
  budget_cap: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

/** A BOQ line item (raw DB row, no computed cost columns). */
export interface BoqItem {
  id: string;
  boq_id: string;
  section_id: string | null;
  element_id: string | null;
  item_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  material_cost: string | null;
  labour_cost: string | null;
  overhead_pct: string;
  margin_pct: string;
  lifecycle_status: BoqItemLifecycleStatus;
  client_approval_status: BoqItemClientApprovalStatus;
  client_approved_at: string | null;
  client_approved_by: string | null;
  requires_reapproval: boolean;
  element_archived: boolean;
  installed_qty: string;
  has_snag: boolean;
  po_status: BoqItemPoStatus;
  notes: string | null;
  client_notes: string | null;
  sort_order: number;
  is_provisional: boolean;
  is_excluded: boolean;
  created_at: string;
  updated_at: string;
}

/** BOQ line item with derived cost columns (computed in SELECT, not stored). */
export interface BoqItemWithComputed extends BoqItem {
  total_cost: string;
  subtotal: string;
  sell_price: string;
  progress_pct: string;
  margin_alert: boolean;
}

/** Aggregate totals for a BOQ (used by /summary and the full-BOQ response). */
export interface BoqSummary {
  total_cost: string;
  total_sell_price: string;
  subtotal: string;
  pre_vat_total: string;
  client_total: string;
  average_margin_pct: string;
  margin_bleed_count: number;
  pending_approvals: number;
  item_count: number;
  section_totals: Array<{
    section_id: string | null;
    section_title: string | null;
    total_cost: string;
    total_sell_price: string;
    item_count: number;
  }>;
}

/** Full BOQ payload — header + sections + items (with computed) + summary. */
export interface BoqWithDetails extends Boq {
  sections: BoqSection[];
  items: BoqItemWithComputed[];
  summary: BoqSummary;
}
