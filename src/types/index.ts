import type {
  TaskStatus,
  TaskPriority,
  TaskCategory,
  BoqStatus,
  BoqItemLifecycleStatus,
  BoqItemClientApprovalStatus,
  BoqItemPoStatus,
  BoqItemSource,
  VendorStatus,
  VendorProficiency,
  VendorKycStatus,
  VendorKycDocumentType,
  RateContractStatus,
} from "@/lib/validations";

export type {
  VendorStatus,
  VendorProficiency,
  VendorKycStatus,
  VendorKycDocumentType,
  RateContractStatus,
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
  service_charge_pct: string;
  margin_pct: string;
  client_rate: string | null;
  budget_rate: string | null;
  source: BoqItemSource;
  rate_contract_item_id: string | null;
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

// ---------------------------------------------------------------------------
// BOQ Excel Import (Feature 6)
// ---------------------------------------------------------------------------

/** Minimal element projection used for preview-time code → element linking. */
export interface BoqElementLite {
  id: string;
  code: string;
  name: string;
}

/** Allowed units — narrowed from `ElementUnit` in validations.ts. */
export type BoqUnit =
  | "m2"
  | "m3"
  | "lm"
  | "no"
  | "item"
  | "kg"
  | "tonne"
  | "ls"
  | "set"
  | "pair"
  | "roll"
  | "sheet"
  | "bag"
  | "box"
  | "pallet";

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
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
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
  address: VendorAddress | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateContractItem {
  id: string;
  rate_contract_id: string;
  element_id: string;
  unit: string;
  rate: number;
  notes: string | null;
}

export interface RateContractItemWithElement extends RateContractItem {
  element_code: string;
  element_name: string;
  element_unit: string;
  element_archived: boolean;
}

export interface RateContractListRow extends RateContract {
  vendor_name: string;
  vendor_kyc_status: VendorKycStatus;
  item_count: number;
}

export interface RateContractWithDetails extends RateContractListRow {
  items: RateContractItemWithElement[];
}

/** Flattened across active contracts for one element. Used by the BOQ picker. */
export interface AvailableRate {
  rate_contract_item_id: string;
  rate_contract_id: string;
  contract_number: string;
  contract_name: string;
  vendor_id: string;
  vendor_name: string;
  element_id: string;
  element_code: string;
  element_name: string;
  unit: string;
  rate: number;
  currency: string;
  end_date: string;
}
