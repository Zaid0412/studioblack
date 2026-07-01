import type {
  ElementUnit,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  BoqItemPhase,
  BoqItemPoStatus,
  BoqItemSource,
  RfqStatus,
  VendorStatus,
  VendorProficiency,
  VendorKycStatus,
  VendorKycDocumentType,
  RateContractStatus,
  RateContractType,
  RateContractPriceBasis,
  VendorQuoteStatus,
  RfqResponseSource,
} from "@/lib/validations";

export type {
  VendorStatus,
  VendorProficiency,
  VendorKycStatus,
  VendorKycDocumentType,
  RateContractStatus,
  RfqStatus,
  VendorQuoteStatus,
};

/** Roles available to authenticated users. */
export type UserRole = "pm" | "architect" | "client" | "vendor";

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

/** Per-project document section (folder), e.g. "Minutes of Meeting". */
export interface DbProjectDocumentSection {
  id: string;
  project_id: string;
  name: string;
  /** Lucide icon name. */
  icon: string;
  position: number;
  /**
   * Parent section id when this is a sub-section, null at top-level. One
   * level of nesting only — depth is enforced in queries.
   */
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /**
   * Document count for this section. For a parent, includes its children's
   * documents (joined in `listDocumentSections`).
   */
  doc_count: number;
}

/** A document file uploaded to a project document section. */
export interface DbProjectDocument {
  id: string;
  project_id: string;
  section_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  description: string | null;
  /** 1-indexed; latest row in a `version_group` has the highest value. */
  version: number;
  /** Shared UUID for every row in a document's version history. */
  version_group: string;
  /** Joined from `user.name`; null when the uploader has been deleted. */
  uploaded_by_name?: string | null;
  /** Joined section name — only populated by `listProjectDocuments` (All view). */
  section_name?: string | null;
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

/** Shape annotation geometry — all coordinates are percent-based (0–100). */
export type PinShapeData =
  | { x: number; y: number; w: number; h: number } // rectangle (top-left + size)
  | { cx: number; cy: number; rx: number; ry: number } // circle (ellipse center + radii)
  | { points: Array<[number, number]> }; // freehand path

export type PinShapeType = "rectangle" | "circle" | "freehand";

/** Per-shape styling — applied to a single shape, not the whole comment. */
export interface PinShapeStyle {
  color: string;
  strokeWidth: number;
  opacity: number;
  fill: boolean;
}

/** Shape annotation payload — geometry + style, discriminated by `type`. */
export type PinShape =
  | ({
      type: "rectangle";
      x: number;
      y: number;
      w: number;
      h: number;
    } & PinShapeStyle)
  | ({
      type: "circle";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
    } & PinShapeStyle)
  | ({
      type: "freehand";
      points: Array<[number, number]>;
    } & PinShapeStyle);

/** A shape annotation as persisted in `pin_comment_shape`. */
export interface DbPinShape {
  id: string;
  pin_comment_id: string;
  shape_type: PinShapeType;
  shape_data: PinShapeData;
  shape_color: string | null;
  shape_stroke_width: number | null;
  shape_opacity: number | null;
  shape_fill: boolean | null;
  order_index: number;
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
  /**
   * Shape annotations attached to this comment, in draw order. Empty when
   * the comment is pin-only or content-only.
   */
  shapes: DbPinShape[];
  /**
   * @deprecated Legacy single-shape fields — replaced by `shapes`. Present on
   * the DB row only until the cleanup migration drops the columns. New code
   * must read from `shapes`.
   */
  shape_type?: PinShapeType | null;
  shape_data?: PinShapeData | null;
  shape_color?: string | null;
  shape_stroke_width?: number | null;
  shape_opacity?: number | null;
  shape_fill?: boolean | null;
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
  /**
   * Discriminator for rows returned in the approval/comment buckets:
   *
   * - `task` (or absent) — a real task row, click → side panel.
   * - `pin_comment` — synthesized from a file-review pin annotation,
   *   click → file review viewer with the pin expanded.
   * - `comment` — synthesized from a project/phase-level comment, click →
   *   project page.
   *
   * Will go away when the polymorphic Request entity ships in Phase 4.
   */
  _source?: "task" | "pin_comment" | "comment";
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

/** Inline attachment reference stored on a task comment (GH-style). */
export interface TaskCommentAttachment {
  /** Storage URL of the uploaded file. */
  url: string;
  /** Original file name. */
  name: string;
  /** MIME type — used by the renderer to inline images vs link files. */
  contentType: string;
  /** Size in bytes; null when unknown. */
  size: number | null;
}

/** A comment on a standalone task. Inline attachments live in `attachments`. */
export interface TaskComment {
  id: string;
  org_id: string;
  task_id: string;
  author_id: string;
  body: string;
  attachments: TaskCommentAttachment[];
  created_at: string;
  updated_at: string | null;
  /** Joined display name from the user table. */
  author_name: string;
}

/**
 * One entry in the `/tasks/[id]` timeline. Comments come from `task_comment`;
 * events come from `audit_event` (filtered to task-relevant actions). The UI
 * renders each kind differently: comments as full cards, events as compact
 * single-line rail entries.
 */
export type TaskActivityEntry =
  | {
      kind: "comment";
      id: string;
      author_id: string;
      author_name: string;
      body: string;
      attachments: TaskCommentAttachment[];
      created_at: string;
      updated_at: string | null;
    }
  | {
      kind: "event";
      id: string;
      actor_id: string | null;
      actor_name: string | null;
      action: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    };

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
  service_charge_pct: string | null;
  margin_pct: string | null;
  client_rate: string | null;
  budget_rate: string | null;
  spec_reference: string | null;
  drawing_ref: string | null;
  tags: string[] | null;
  is_active: boolean;
  /** Public URL of the element's hero image. Null if none uploaded. */
  image_url: string | null;
  /** Public URL of the production drawing file. Null if none uploaded. */
  drawing_file_url: string | null;
  /** Original filename of the production drawing for display + download. */
  drawing_file_name: string | null;
  /** Public URL of the specification / element guideline file. */
  spec_file_url: string | null;
  /** Original filename of the spec file for display + download. */
  spec_file_name: string | null;
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
  /** Optional user-supplied label. Drawer / detail UIs prefer this over `element_name`. */
  name: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  material_cost: string | null;
  labour_cost: string | null;
  overhead_pct: string;
  service_charge_pct: string;
  margin_pct: string;
  client_rate: string | null;
  budget_rate: string | null;
  length: string | null;
  breadth: string | null;
  height: string | null;
  /** Unit for L/B/H. 'm' stores decimal metres; 'ft' stores decimal feet. */
  dimension_unit: "m" | "ft";
  source: BoqItemSource;
  rate_contract_item_id: string | null;
  phase: BoqItemPhase;
  sent_to_client_at: string | null;
  client_decided_at: string | null;
  element_archived: boolean;
  /** Library element's `name` (null when item isn't library-linked, or the link is broken). */
  element_name: string | null;
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
  over_budget: boolean;
  budget_variance_pct: string | null;
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
  over_budget_count: number;
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

/**
 * Audit-event row for the most recent change-request on a BOQ item.
 * Shared between the server query (`@/lib/queries/boq.ts`) and the
 * client-side fetcher (`@/lib/api/boq.ts`) so the shape only lives once.
 */
export interface BoqItemChangeRequest {
  actor_id: string;
  actor_name: string | null;
  to_phase: "internal_changes_requested" | "client_changes_requested";
  comment: string | null;
  created_at: string;
}

/**
 * One row in the per-item phase-change timeline. Sourced from `audit_event`
 * (single-item rows + bulk rows whose `metadata.item_ids` contains this id).
 *
 * Old single-item rows that pre-date the lifecycle-8 work may lack a `from`
 * in their metadata — those render with `from_phase: null` ("→ X" only).
 * Bulk rows carry per-item `from_phase` via `metadata.item_phases`, which
 * was added alongside the timeline endpoint.
 */
/**
 * Minimal BOQ item reference used by surfaces that list items by id (e.g.
 * the "items in this batch" popover on the activity timeline).
 */
export interface BoqBulkItemRef {
  id: string;
  item_code: string;
  description: string;
}

export interface BoqItemHistoryEvent {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  from_phase: import("@/lib/validations").BoqItemPhase | null;
  to_phase: import("@/lib/validations").BoqItemPhase;
  comment: string | null;
  is_bulk: boolean;
  bulk_item_count: number | null;
  /**
   * Every item the bulk action touched (including the one being viewed),
   * resolved server-side from `metadata.item_ids` against `boq_item`.
   * Populated only when `is_bulk` is true; null otherwise. Drives the
   * "items in this batch" popover on the activity timeline.
   */
  bulk_items: BoqBulkItemRef[] | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// BOQ Excel Import (Feature 6)
// ---------------------------------------------------------------------------

/** Minimal element projection used for preview-time code → element linking. */
export interface BoqElementLite {
  id: string;
  code: string;
  name: string;
}

/** Allowed BOQ units — single source of truth is `ALLOWED_UNITS` in validations.ts. */
export type BoqUnit = ElementUnit;

/**
 * One import row after parsing. Shape lines up with `boqImportRowSchema` so
 * the server re-validates on confirm without remapping.
 */
export interface ParsedBoqValues {
  rowNumber: number;
  sectionTitle?: string;
  itemCode?: string;
  description: string;
  unit: BoqUnit;
  quantity: number;
  unitCost: number;
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  marginPct?: number;
  clientRate?: number;
  budgetRate?: number;
  length?: number;
  breadth?: number;
  height?: number;
  dimensionUnit?: "m" | "ft";
  notes?: string;
  clientNotes?: string;
  isProvisional?: boolean;
}

export interface ParsedBoqRow {
  /**
   * Literal Excel row index (header is row 1). The value the user sees in
   * their sheet — also what flows to `failed[].rowNumber` on confirm.
   */
  rowNumber: number;
  raw: Record<string, unknown>;
  parsed: ParsedBoqValues | null;
  /** Resolved during preview when `itemCode` matches an org element by code. */
  linkedElement?: BoqElementLite;
  status: "valid" | "error";
  errors: string[];
  /** Non-fatal notes surfaced in the preview (locale decimal warnings, etc.). */
  warnings: string[];
}

export interface BoqParseResult {
  headers: string[];
  unknownColumns: string[];
  missingColumns: string[];
  /** Template columns that appeared more than once — latest occurrence wins. */
  duplicateColumns: string[];
  rows: ParsedBoqRow[];
  totalRows: number;
  /** True when the sheet was truncated by `MAX_DATA_ROWS`. */
  truncated?: boolean;
}

export interface BulkBoqImportResult {
  inserted: number;
  replaced: number;
  /** Sections created by the import (by title → id). */
  createdSections: Array<{ id: string; title: string }>;
  /** Rows that failed — should be rare; any failure triggers a full rollback. */
  failed: Array<{ rowNumber: number; error: string }>;
  /**
   * True when the whole transaction was rolled back due to a row-level error.
   * `failed[]` carries only the offending row's message; everything else was
   * reverted. UI uses this to show "import rolled back" instead of the
   * misleading "0 inserted · 1 failed".
   */
  rolledBack?: boolean;
}

// ── Vendor Management (F7) ───────────────────────────────────────────────────

export interface VendorAddress {
  /** Optional human label — e.g. "HQ", "Warehouse", "Billing". */
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  /** At most one address per vendor should carry `is_primary: true`. */
  is_primary?: boolean;
}

/**
 * Plain (decrypted) bank details. Never serialised to clients except via the
 * dedicated bank-details endpoint, and only to PMs.
 */
export interface BankDetails {
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  iban?: string;
  swift?: string;
  /** India IFSC (11 chars). Stored inside the encrypted envelope. */
  ifsc_code?: string;
  branch?: string;
}

/** AES-256-GCM envelope stored in `vendor.bank_details` JSONB. */
export interface EncryptedField {
  /** Reserved for future key rotation — currently always 1. */
  version: 1;
  /** base64 ciphertext */
  encrypted: string;
  /** base64 IV */
  iv: string;
  /** base64 GCM auth tag */
  tag: string;
}

export interface Vendor {
  id: string;
  org_id: string;
  company_name: string;
  trading_name: string | null;
  vendor_code: string | null;
  status: VendorStatus;
  rating: number;
  payment_terms: string | null;
  currency: string;
  vat_registered: boolean;
  vat_number: string | null;
  tax_id: string | null;
  kyc_status: VendorKycStatus;
  kyc_verified_at: string | null;
  kyc_verified_by: string | null;
  kyc_notes: string | null;
  /**
   * @deprecated Use `addresses` instead. The single-address column is
   * retained for one release while data is migrated; new code should
   * read/write `addresses[]`.
   */
  address: VendorAddress | null;
  addresses: VendorAddress[];
  /** India GST Identification Number (15 chars). Plain text — not sensitive. */
  gstin: string | null;
  website: string | null;
  /**
   * Vendor-wide preferred flag. Distinct from `vendor_trade.proficiency_level`
   * which is per-category — `preferred_vendor` reflects an overall PM
   * preference for sourcing.
   */
  preferred_vendor: boolean;
  /** Free-text brands the vendor carries (e.g. "Asian Paints", "Jaquar"). */
  brands_supported: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorKycDocument {
  id: string;
  vendor_id: string;
  doc_type: VendorKycDocumentType;
  file_url: string;
  file_name: string;
  expires_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
}

export interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  is_primary: boolean;
  is_secondary: boolean;
  receives_rfq: boolean;
  user_id: string | null;
  created_at: string;
}

export interface VendorTrade {
  id: string;
  vendor_id: string;
  category_id: string;
  proficiency_level: VendorProficiency;
  notes: string | null;
}

export interface VendorTradeWithCategory extends VendorTrade {
  category_name: string;
  category_color: string | null;
}

export interface VendorWithRelations extends Vendor {
  contacts: VendorContact[];
  trades: VendorTradeWithCategory[];
  kyc_expiring_soon_count?: number;
}

/**
 * Vendor-portal self-view. The PM-only `preferred_vendor` flag is stripped
 * at the query layer so it never reaches a vendor user; this type makes the
 * boundary explicit instead of relying on a SQL literal.
 */
export type VendorSelfView = Omit<VendorWithRelations, "preferred_vendor">;

/** Lite shape used in F9 RFQ vendor suggestion lists. */
export interface VendorLite {
  id: string;
  company_name: string;
  vendor_code: string | null;
  status: VendorStatus;
  rating: number;
  primary_contact_email: string | null;
}

// ── Audit Infrastructure (F7, reused by F21) ─────────────────────────────────

export interface AuditEvent {
  id: string;
  org_id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Rate Contracts (F7.5) ────────────────────────────────────────────────────

export interface RateContract {
  id: string;
  org_id: string;
  vendor_id: string;
  contract_number: string;
  name: string;
  status: RateContractStatus;
  start_date: string;
  end_date: string;
  agreement_signed_date: string | null;
  currency: string;
  payment_terms: string | null;
  agreement_url: string | null;
  terms_and_conditions: string | null;
  notes: string | null;
  contract_type: RateContractType | null;
  credit_period_days: number | null;
  delivery_terms: string | null;
  price_basis: RateContractPriceBasis | null;
  renewal_date: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateContractItem {
  id: string;
  rate_contract_id: string;
  /** Service area (taxonomy leaf) the rate is agreed for — the primary target. */
  category_id: string;
  /** Optional element override; null = the rate applies to the whole service area. */
  element_id: string | null;
  unit: string;
  rate: number;
  notes: string | null;
  description: string | null;
  min_qty: number | null;
  max_qty: number | null;
  lead_time_days: number | null;
  valid_until: string | null;
}

export interface RateContractItemWithTarget extends RateContractItem {
  /** Service area (always present). */
  category_name: string;
  category_code: string | null;
  /** Element override (present only when element_id is set). */
  element_code: string | null;
  element_name: string | null;
  element_unit: string | null;
  element_archived: boolean | null;
}

export interface RateContractListRow extends RateContract {
  vendor_name: string;
  vendor_kyc_status: VendorKycStatus;
  item_count: number;
}

export interface RateContractWithDetails extends RateContractListRow {
  items: RateContractItemWithTarget[];
  /** Display name of the approver (null until approved). */
  approved_by_name: string | null;
}

/** Why an available rate matched a BOQ item (most specific first). */
export type RateMatchType = "element" | "service_area" | "ancestor";

/** Flattened across active contracts. Used by the BOQ picker + per-item matcher. */
export interface AvailableRate {
  rate_contract_item_id: string;
  rate_contract_id: string;
  contract_number: string;
  contract_name: string;
  vendor_id: string;
  vendor_name: string;
  category_id: string;
  category_name: string;
  category_code: string | null;
  element_id: string | null;
  element_code: string | null;
  element_name: string | null;
  unit: string;
  rate: number;
  currency: string;
  end_date: string;
  /** Set only by the per-BOQ-item matcher (`getActiveRatesForBoqItem`). */
  match_type?: RateMatchType;
}

// ── RFQ (F9) ────────────────────────────────────────────────────────────────

export interface Rfq {
  id: string;
  org_id: string;
  project_id: string;
  rfq_number: string;
  title: string;
  status: RfqStatus;
  issued_date: string | null;
  response_deadline: string | null;
  award_date: string | null;
  awarded_vendor_id: string | null;
  scope_of_work: string | null;
  terms_conditions: string | null;
  attachments: unknown | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfqItem {
  id: string;
  rfq_id: string;
  boq_item_id: string;
  description: string;
  unit: string;
  quantity: number;
  spec_notes: string | null;
  sort_order: number;
  awarded_vendor_id: string | null;
  awarded_quote_item_id: string | null;
}

export interface RfqVendorInvite {
  rfq_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string | null;
  invited_at: string;
  invited_by: string | null;
}

/**
 * One row from the status timeline on the RFQ detail page. Sourced from
 * `audit_event` and joined with the actor's display name. For vendor-facing
 * responses, `actorId` and `actorName` are blanked.
 */
export interface RfqEvent {
  id: string;
  /** Audit action key, e.g. `"rfq.created" | "rfq.issued" | "rfq.cancelled"`. */
  action: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
}

/** List-row shape: a compact RFQ summary with counts. */
export interface RfqListRow {
  id: string;
  rfq_number: string;
  title: string;
  status: RfqStatus;
  issued_date: string | null;
  response_deadline: string | null;
  item_count: number;
  vendor_count: number;
  created_at: string;
  latest_quote_submitted_at: string | null;
}

/** Full RFQ + items + invited vendors + audit timeline. Detail-view payload. */
export interface RfqWithItems extends Rfq {
  items: RfqItem[];
  vendors: RfqVendorInvite[];
  events: RfqEvent[];
}

// ── Vendor Quotes (F10) ─────────────────────────────────────────────────────

/** Evidence file reference stored in `vendor_quote.attachments` (jsonb). */
export interface QuoteAttachment {
  url: string;
  fileName: string;
}

export interface VendorQuote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  status: VendorQuoteStatus;
  /** How the quote reached us (portal = vendor self-service). */
  response_source: RfqResponseSource;
  /** When the quote was received off-channel (null for portal submissions). */
  received_date: string | null;
  /** Studio user who keyed a manual quote (null when vendor-submitted). */
  entered_by: string | null;
  submitted_at: string;
  valid_until: string | null;
  currency: string;
  delivery_period: string | null;
  payment_terms: string | null;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  attachments: QuoteAttachment[] | null;
  is_late: boolean;
  awarded_at: string | null;
  awarded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorQuoteItem {
  id: string;
  quote_id: string;
  rfq_item_id: string;
  unit_price: number;
  notes: string | null;
  alternative_spec: string | null;
}

/** Quote detail with line items + vendor display fields joined. */
export interface VendorQuoteWithItems extends VendorQuote {
  items: VendorQuoteItem[];
  vendor_name: string;
  vendor_code: string | null;
}

/**
 * One row in the side-by-side comparison table. Maps `vendor_id` → that
 * vendor's line for this RFQ item (or absent if they did not bid on it).
 */
export interface QuoteComparisonRow {
  rfq_item_id: string;
  boq_item_id: string;
  description: string;
  unit: string;
  quantity: number;
  spec_notes: string | null;
  sort_order: number;
  vendor_prices: Record<
    string,
    {
      quote_id: string;
      quote_item_id: string;
      unit_price: number;
      line_total: number;
      notes: string | null;
      alternative_spec: string | null;
      is_lowest: boolean;
    }
  >;
}

export interface QuoteComparisonVendorColumn {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string | null;
  quote_id: string;
  quote_status: VendorQuoteStatus;
  response_source: RfqResponseSource;
  is_late: boolean;
  valid_until: string | null;
  delivery_period: string | null;
  payment_terms: string | null;
  inclusions: string | null;
  exclusions: string | null;
  currency: string;
  grand_total: number;
  submitted_at: string;
}

/** Denormalised shape consumed by the comparison page. */
export interface QuoteComparison {
  rfq_id: string;
  items: QuoteComparisonRow[];
  vendors: QuoteComparisonVendorColumn[];
  invited_no_response: { vendor_id: string; vendor_name: string }[];
}
