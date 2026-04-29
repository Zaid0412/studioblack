import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { AuditEvent } from "@/types";

/** Stable identifiers for audit log entries. Append-only — never rename. */
export const AUDIT_ACTIONS = {
  VENDOR_BANK_READ: "vendor.bank_details.read",
  VENDOR_BANK_WRITE: "vendor.bank_details.write",
  VENDOR_BANK_CLEAR: "vendor.bank_details.clear",
  VENDOR_KYC_DOCUMENT_ADDED: "vendor.kyc.document_added",
  VENDOR_KYC_DOCUMENT_REMOVED: "vendor.kyc.document_removed",
  VENDOR_KYC_STATUS_CHANGED: "vendor.kyc.status_changed",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Append a structured audit event. Used by sensitive endpoints (e.g. vendor
 * bank-details GET/PUT) to record who did what when. F21 will surface these
 * via a UI; for now they're write-only from the app's perspective.
 *
 * Failures here do not block the calling action — the underlying mutation
 * may have already succeeded — but they are logged via the caller's logger.
 */
export async function logAudit(input: {
  orgId: string;
  actorId: string | null;
  action: string;
  targetTable: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_event (org_id, actor_id, action, target_table, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.orgId,
      input.actorId,
      input.action,
      input.targetTable,
      input.targetId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}

/**
 * Fire-and-forget wrapper. Failures are logged via `logger.warn` instead of
 * propagating, since audit logging must not undo a successful mutation.
 */
export async function logAuditSafe(
  input: Parameters<typeof logAudit>[0]
): Promise<void> {
  try {
    await logAudit(input);
  } catch (err) {
    logger.warn("audit log failed", { err: String(err) });
  }
}

/** Read recent audit events for an org. Reserved for F21. */
export async function getAuditEvents(
  orgId: string,
  filters: {
    targetTable?: string;
    targetId?: string;
    actorId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditEvent[]> {
  const pool = getPool();
  const conditions: string[] = ["org_id = $1"];
  const params: unknown[] = [orgId];

  if (filters.targetTable) {
    params.push(filters.targetTable);
    conditions.push(`target_table = $${params.length}`);
  }
  if (filters.targetId) {
    params.push(filters.targetId);
    conditions.push(`target_id = $${params.length}`);
  }
  if (filters.actorId) {
    params.push(filters.actorId);
    conditions.push(`actor_id = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    conditions.push(`action = $${params.length}`);
  }

  params.push(filters.limit ?? 100);
  const limitIdx = params.length;
  params.push(filters.offset ?? 0);
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT * FROM audit_event
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows as AuditEvent[];
}
