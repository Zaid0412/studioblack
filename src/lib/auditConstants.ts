/**
 * Audit constants and types — server-free, safe to import from client
 * components. The runtime helpers (`logAudit`, `logAuditSafe`,
 * `getAuditEvents`) live in `@/lib/queries/audit` and pull in `pg`, so
 * importing that module from a `"use client"` boundary drags the entire
 * Node.js stack (`net` / `tls` / `dns` / `fs`) into the browser bundle
 * and breaks the Next/Turbopack build.
 *
 * Splitting the constants out lets the timeline UI reference action keys
 * (`AUDIT_ACTIONS.TASK_STATUS_CHANGED` etc.) without importing the db
 * pool transitively.
 */

/** Where the audit event originated. */
export const AUDIT_SOURCES = {
  SELF_SERVICE: "self_service",
} as const;
export type AuditSource = (typeof AUDIT_SOURCES)[keyof typeof AUDIT_SOURCES];

/** Stable identifiers for audit log entries. Append-only — never rename. */
export const AUDIT_ACTIONS = {
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
  // ── BOQ per-item lifecycle ─────────────────────────────────────────────
  BOQ_ITEM_PHASE_CHANGED: "boq.item.phase_changed",
  // ── Tasks (rendered in /tasks/[id] timeline) ────────────────────────────
  TASK_STATUS_CHANGED: "task.status_changed",
  TASK_PRIORITY_CHANGED: "task.priority_changed",
  TASK_CATEGORY_CHANGED: "task.category_changed",
  TASK_ASSIGNEE_CHANGED: "task.assignee_changed",
  TASK_DUE_DATE_CHANGED: "task.due_date_changed",
  TASK_PROJECT_CHANGED: "task.project_changed",
  TASK_PHASE_CHANGED: "task.phase_changed",
  TASK_TITLE_CHANGED: "task.title_changed",
  TASK_DESCRIPTION_CHANGED: "task.description_changed",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Subset of audit actions that surface in the task activity feed. */
export const TASK_AUDIT_ACTIONS: ReadonlySet<string> = new Set([
  AUDIT_ACTIONS.TASK_STATUS_CHANGED,
  AUDIT_ACTIONS.TASK_PRIORITY_CHANGED,
  AUDIT_ACTIONS.TASK_CATEGORY_CHANGED,
  AUDIT_ACTIONS.TASK_ASSIGNEE_CHANGED,
  AUDIT_ACTIONS.TASK_DUE_DATE_CHANGED,
  AUDIT_ACTIONS.TASK_PROJECT_CHANGED,
  AUDIT_ACTIONS.TASK_PHASE_CHANGED,
  AUDIT_ACTIONS.TASK_TITLE_CHANGED,
  AUDIT_ACTIONS.TASK_DESCRIPTION_CHANGED,
]);
