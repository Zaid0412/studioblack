import { getPool } from "@/lib/db";
import { getNextSequenceNumber } from "./boq";
import { cloneRfqAsRevision, syncRfqItemsFromBoq } from "./rfqs";
import {
  DEFAULT_IMPACT_FOR_REASON,
  SCOPE_CHANGE_TRANSITIONS,
  type ScopeChangeAction,
  type ScopeChangeImpact,
  type ScopeChangeReason,
} from "@/lib/validations";
import type {
  ScopeChange,
  ScopeChangeListRow,
  ScopeChangeStatus,
} from "@/types";

interface CreateScopeChangeInput {
  boqItemId: string;
  changeReason: ScopeChangeReason;
  description?: string | null;
  impact?: ScopeChangeImpact;
}

interface UpdateScopeChangeInput {
  changeReason?: ScopeChangeReason;
  description?: string | null;
  impact?: ScopeChangeImpact;
}

/** camelCase patch key → snake_case column, for the requested-state edit. */
const EDIT_COLS: Record<string, string> = {
  changeReason: "change_reason",
  description: "description",
  impact: "impact",
};

/** Columns selected for a list/detail row (with display joins). */
const LIST_SELECT = `
  SELECT
    sc.*,
    bi.name AS boq_item_name,
    bi.item_code AS boq_item_code,
    p.name AS project_name,
    requester.name AS requested_by_name
  FROM scope_change sc
  JOIN boq_item bi ON bi.id = sc.boq_item_id
  JOIN project p ON p.id = sc.project_id
  LEFT JOIN "user" requester ON requester.id = sc.requested_by`;

/**
 * Raise a scope change against a BOQ item. Resolves the item's project inside
 * the org (never trusts a client-supplied project id), defaults the impact from
 * the change reason when omitted, and opens in `requested`.
 */
export async function createScopeChange(
  orgId: string,
  userId: string,
  input: CreateScopeChangeInput
): Promise<{ ok: true; row: ScopeChange } | { ok: false; reason: string }> {
  const pool = getPool();

  // Resolve the item's project within this org — this is also the access check.
  const { rows: itemRows } = await pool.query<{ project_id: string }>(
    `SELECT b.project_id
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       JOIN project p ON p.id = b.project_id
      WHERE bi.id = $1 AND p.org_id = $2`,
    [input.boqItemId, orgId]
  );
  const projectId = itemRows[0]?.project_id;
  if (!projectId) {
    return { ok: false, reason: "boq_item_not_found" };
  }

  const impact = input.impact ?? DEFAULT_IMPACT_FOR_REASON[input.changeReason];
  const scNumber = await getNextSequenceNumber(orgId, "SC");

  const { rows } = await pool.query<ScopeChange>(
    `INSERT INTO scope_change (
       org_id, project_id, boq_item_id, sc_number,
       change_reason, description, impact, status, requested_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested', $8)
     RETURNING *`,
    [
      orgId,
      projectId,
      input.boqItemId,
      scNumber,
      input.changeReason,
      input.description ?? null,
      impact,
      userId,
    ]
  );
  return { ok: true, row: rows[0] };
}

/** Full detail row (with display joins). */
export async function getScopeChangeById(
  orgId: string,
  id: string
): Promise<ScopeChangeListRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<ScopeChangeListRow>(
    `${LIST_SELECT} WHERE sc.id = $1 AND sc.org_id = $2`,
    [id, orgId]
  );
  return rows[0] ?? null;
}

interface ListScopeChangesFilters {
  projectId?: string;
  boqItemId?: string;
  status?: ScopeChangeStatus;
  page: number;
  limit: number;
}

/** Paginated list for the studio panel / client pending-list. */
export async function listScopeChanges(
  orgId: string,
  filters: ListScopeChangesFilters
): Promise<{ rows: ScopeChangeListRow[]; total: number }> {
  const pool = getPool();
  const conditions = ["sc.org_id = $1"];
  const params: unknown[] = [orgId];

  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`sc.project_id = $${params.length}`);
  }
  if (filters.boqItemId) {
    params.push(filters.boqItemId);
    conditions.push(`sc.boq_item_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`sc.status = $${params.length}`);
  }
  const where = conditions.join(" AND ");

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM scope_change sc WHERE ${where}`,
    params
  );
  const total = Number(countRows[0]?.count ?? 0);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);
  const { rows } = await pool.query<ScopeChangeListRow>(
    `${LIST_SELECT} WHERE ${where}
     ORDER BY sc.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows, total };
}

/**
 * Edit an unsubmitted scope change (reason / description / impact). Allowed only
 * while `requested`; once submitted the record is immutable except via
 * transitions. Returns the columns actually written so the caller audits a real
 * change only.
 */
export async function updateScopeChange(
  orgId: string,
  id: string,
  patch: UpdateScopeChangeInput
): Promise<
  | { ok: true; row: ScopeChange; changedColumns: string[] }
  | { ok: false; reason: string }
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<ScopeChange>(
      `SELECT * FROM scope_change WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [id, orgId]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (cur.rows[0].status !== "requested") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_editable" };
    }

    const changedColumns: string[] = [];
    const setClauses: string[] = [];
    const params: unknown[] = [id, orgId];
    for (const [key, col] of Object.entries(EDIT_COLS)) {
      if (key in patch) {
        params.push((patch as Record<string, unknown>)[key]);
        setClauses.push(`${col} = $${params.length}`);
        changedColumns.push(col);
      }
    }

    if (setClauses.length === 0) {
      // No real column to write — return the locked row directly, no 2nd query.
      await client.query("ROLLBACK");
      return { ok: true, row: cur.rows[0], changedColumns };
    }

    setClauses.push(`updated_at = now()`);
    const { rows } = await client.query<ScopeChange>(
      `UPDATE scope_change SET ${setClauses.join(", ")}
        WHERE id = $1 AND org_id = $2
        RETURNING *`,
      params
    );
    await client.query("COMMIT");
    return { ok: true, row: rows[0], changedColumns };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Advance a scope change through its lifecycle (submit / send_to_client /
 * approve / reject_review / reject_client). `implement` is separate — it runs
 * side effects (see implementScopeChange).
 */
export async function transitionScopeChange(
  orgId: string,
  id: string,
  action: ScopeChangeAction,
  actor: { userId: string; role: string },
  note?: string | null
): Promise<{ ok: true; row: ScopeChange } | { ok: false; reason: string }> {
  const transition = SCOPE_CHANGE_TRANSITIONS[action];
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ status: ScopeChangeStatus }>(
      `SELECT status FROM scope_change WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [id, orgId]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (!transition.from.includes(cur.rows[0].status)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status_transition" };
    }
    if (
      !transition.roles.includes(actor.role as "pm" | "architect" | "client")
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "forbidden" };
    }

    const setClauses = ["status = $3", "updated_at = now()"];
    const params: unknown[] = [id, orgId, transition.to];
    for (const effect of transition.effects ?? []) {
      if (effect.op === "now") {
        setClauses.push(`${effect.col} = now()`);
      } else {
        // "actor" → acting user id; "note" → the request's note.
        params.push(
          effect.op === "actor" ? actor.userId : note?.trim() || null
        );
        setClauses.push(`${effect.col} = $${params.length}`);
      }
    }

    const { rows } = await client.query<ScopeChange>(
      `UPDATE scope_change SET ${setClauses.join(", ")}
        WHERE id = $1 AND org_id = $2
        RETURNING *`,
      params
    );
    await client.query("COMMIT");
    return { ok: true, row: rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** The most recent non-terminal RFQ that includes this BOQ item, if any. */
async function getActiveRfqIdForBoqItem(
  orgId: string,
  boqItemId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ rfq_id: string }>(
    `SELECT r.id AS rfq_id
       FROM rfq_item ri
       JOIN rfq r ON r.id = ri.rfq_id
      WHERE ri.boq_item_id = $1
        AND r.org_id = $2
        AND r.status NOT IN ('cancelled', 'superseded')
      ORDER BY r.created_at DESC
      LIMIT 1`,
    [boqItemId, orgId]
  );
  return rows[0]?.rfq_id ?? null;
}

/**
 * Execute an approved scope change. Per `impact`:
 *  - cancel_item → BOQ item to `cancelled` + excluded from future RFQ revisions
 *  - update_rfq  → sync the item's live RFQ quantities
 *  - requote     → retire the item's RFQ and raise a revision
 *  - new_rfq     → no auto-side-effect (item is in-procurement so createRfqDraft's
 *                  eligibility gate would reject it); recorded for PM follow-up
 * Links the resulting boq_item_version / rfq back onto the row.
 *
 * The `approved → implemented` flip is done first as a single atomic UPDATE
 * (the "claim"): it serialises concurrent implements and makes a retry safe (a
 * second call sees `implemented` and bails), so we do NOT hold a pooled
 * connection while the impact runs. That matters because `syncRfqItemsFromBoq`
 * / `cloneRfqAsRevision` each open their own connection+transaction — holding
 * one here across those calls could exhaust the pool under concurrency.
 */
export async function implementScopeChange(
  orgId: string,
  id: string,
  actor: { userId: string }
): Promise<{ ok: true; row: ScopeChange } | { ok: false; reason: string }> {
  const pool = getPool();

  // 1. Atomic claim: only an `approved` row flips, and only once.
  const claim = await pool.query<ScopeChange>(
    `UPDATE scope_change
        SET status = 'implemented', updated_at = now()
      WHERE id = $1 AND org_id = $2 AND status = 'approved'
      RETURNING *`,
    [id, orgId]
  );
  if (claim.rows.length === 0) {
    // Nothing claimed — distinguish "wrong status" from "missing".
    const { rows } = await pool.query(
      `SELECT 1 FROM scope_change WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    return {
      ok: false,
      reason: rows.length > 0 ? "invalid_status_transition" : "not_found",
    };
  }
  const sc = claim.rows[0];

  // 2. Latest BOQ version for the item (edits go through the normal BOQ flow,
  //    which snapshots a version); link it for traceability.
  const { rows: verRows } = await pool.query<{ id: string }>(
    `SELECT id FROM boq_item_version
      WHERE boq_item_id = $1
      ORDER BY version_number DESC
      LIMIT 1`,
    [sc.boq_item_id]
  );
  const versionId = verRows[0]?.id ?? null;

  // 3. Run the impact. Each sub-operation is atomic on its own connection; we
  //    hold none here. A draft/terminal RFQ that isn't revisable is a no-op
  //    (nothing to sync/revise yet) — not an error.
  let rfqId: string | null = null;
  if (sc.impact === "cancel_item") {
    await pool.query(
      `UPDATE boq_item bi
          SET phase = 'cancelled', is_excluded = true, updated_at = now()
         FROM boq b
        WHERE bi.id = $1 AND bi.boq_id = b.id AND b.project_id = $2`,
      [sc.boq_item_id, sc.project_id]
    );
  } else if (sc.impact === "update_rfq") {
    const activeRfq = await getActiveRfqIdForBoqItem(orgId, sc.boq_item_id);
    if (activeRfq) {
      const synced = await syncRfqItemsFromBoq(activeRfq);
      if (synced.ok) rfqId = activeRfq;
    }
  } else if (sc.impact === "requote") {
    const activeRfq = await getActiveRfqIdForBoqItem(orgId, sc.boq_item_id);
    if (activeRfq) {
      const revised = await cloneRfqAsRevision(
        activeRfq,
        actor.userId,
        sc.description
      );
      if (revised.ok) rfqId = revised.rfq.id;
    }
  }
  // new_rfq: intentionally no side effect (see doc comment).

  // 4. Link the results onto the (already-implemented) row.
  const { rows } = await pool.query<ScopeChange>(
    `UPDATE scope_change
        SET boq_item_version_id = $3,
            rfq_id = COALESCE($4, rfq_id),
            updated_at = now()
      WHERE id = $1 AND org_id = $2
      RETURNING *`,
    [id, orgId, versionId, rfqId]
  );
  return { ok: true, row: rows[0] };
}
