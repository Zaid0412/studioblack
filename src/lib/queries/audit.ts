import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AUDIT_ACTIONS } from "@/lib/auditConstants";
import type { AuditEvent } from "@/types";

// Constants + types live in a separate module so client components can
// reference action keys (e.g. in the timeline UI) without dragging the
// db pool — and pg's Node-only deps (`net`, `tls`, `dns`, `fs`) — into
// the browser bundle.
export {
  AUDIT_SOURCES,
  AUDIT_ACTIONS,
  TASK_AUDIT_ACTIONS,
  type AuditSource,
  type AuditAction,
} from "@/lib/auditConstants";

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

/**
 * For each BOQ item, find the actor who most recently fired a transition to
 * `targetPhase`. Reads the audit log; returns a map keyed by item id.
 *
 * Used by the phase-notification fan-out to credit the submitter — e.g.
 * notify whoever fired `internal_review` once the item is approved. Items
 * with no matching event (or a null actor) are omitted from the map.
 */
export async function getLastPhaseActors(
  itemIds: readonly string[],
  targetPhase: string
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const pool = getPool();
  // `audit_event.target_id` is uuid — cast the param array to `uuid[]` so
  // Postgres can use `idx_audit_event_target` instead of coercing each row's
  // uuid to text for the equality check.
  const { rows } = await pool.query<{ target_id: string; actor_id: string }>(
    `SELECT DISTINCT ON (target_id) target_id, actor_id
     FROM audit_event
     WHERE target_table = 'boq_item'
       AND target_id = ANY($1::uuid[])
       AND action = $2
       AND metadata->>'to' = $3
       AND actor_id IS NOT NULL
     ORDER BY target_id, created_at DESC`,
    [itemIds, AUDIT_ACTIONS.BOQ_ITEM_PHASE_CHANGED, targetPhase]
  );
  return new Map(rows.map((r) => [r.target_id, r.actor_id]));
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
