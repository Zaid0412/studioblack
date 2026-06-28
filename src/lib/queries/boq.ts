import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mapPgError } from "./_pgErrors";
import type {
  Boq,
  BoqElementLite,
  BoqItemChangeRequest,
  BoqItemHistoryEvent,
  BoqSection,
  BoqItemWithComputed,
  BoqSummary,
  BoqWithDetails,
  BulkBoqImportResult,
  UserRole,
} from "@/types";
import type {
  BoqImportStrategy,
  BoqItemPhase,
  BoqItemSource,
} from "@/lib/validations";
import { BOQ_ITEM_PHASES, BOQ_ITEM_PHASE_TRANSITIONS } from "@/lib/validations";
import { toIso } from "@/lib/formatTime";
import { memberRoleToUserRole } from "@/lib/roles";

const VALID_BOQ_PHASES = new Set<string>(BOQ_ITEM_PHASES);
function asBoqItemPhase(value: unknown): BoqItemPhase | null {
  return typeof value === "string" && VALID_BOQ_PHASES.has(value)
    ? (value as BoqItemPhase)
    : null;
}
import type { z } from "zod";
import type { boqImportRowSchema } from "@/lib/validations";

/**
 * Computed cost columns for BOQ items, injected into SELECTs.
 *
 * Not stored as GENERATED columns because `margin_alert` depends on the parent
 * BOQ's `minimum_margin_pct`, which a generated column on `boq_item` can't
 * reference.
 *
 * Callers MUST join `boq b ON b.id = bi.boq_id` when using this fragment.
 */
const ITEM_COMPUTED_COLS = `
  bi.quantity * bi.unit_cost AS total_cost,
  bi.quantity * bi.unit_cost
    * (1 + COALESCE(bi.overhead_pct, 0)/100)
    * (1 + COALESCE(bi.service_charge_pct, 0)/100) AS subtotal,
  bi.quantity * bi.unit_cost
    * (1 + COALESCE(bi.overhead_pct, 0)/100)
    * (1 + COALESCE(bi.service_charge_pct, 0)/100)
    * (1 + bi.margin_pct/100) AS sell_price,
  CASE
    WHEN bi.installed_qty > 0
    THEN ROUND(bi.installed_qty / NULLIF(bi.quantity, 0) * 100, 1)
    ELSE 0
  END AS progress_pct,
  (bi.margin_pct < b.minimum_margin_pct) AS margin_alert,
  -- A budget of 0 isn't a meaningful target — treat as "no budget set" so the
  -- over-budget badge and variance % stay in lockstep (else: badge fires but
  -- the % renders as NULL).
  (bi.budget_rate IS NOT NULL AND bi.budget_rate > 0
    AND bi.unit_cost > bi.budget_rate) AS over_budget,
  CASE
    WHEN bi.budget_rate IS NULL OR bi.budget_rate = 0 THEN NULL
    ELSE ROUND((bi.unit_cost - bi.budget_rate) / bi.budget_rate * 100, 1)
  END AS budget_variance_pct
`;

/**
 * Library-join columns + join clause. Pulled into a pair so callers can't
 * select `element_name`/`element_archived` without also adding the join,
 * and vice-versa. Used by `ITEM_SELECT` and the four mutation queries that
 * return a fresh item row (create / update / move / lifecycle).
 */
const ITEM_LIBRARY_COLS = `e.name AS element_name, NOT e.is_active AS element_archived`;
const ITEM_LIBRARY_JOIN = `LEFT JOIN element e ON e.id = bi.element_id`;

const ITEM_SELECT = `SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS} FROM boq_item bi JOIN boq b ON b.id = bi.boq_id ${ITEM_LIBRARY_JOIN}`;

/** Confirm a BOQ exists and belongs to the given project. Used for project-scope guards in API routes. */
export async function verifyBoqOwnership(
  boqId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM boq WHERE id = $1 AND project_id = $2`,
    [boqId, projectId]
  );
  return rows.length > 0;
}

/**
 * Fetch BOQ-level context for a single item: project, org, creator, BOQ
 * title, and the item's current phase. Used by the per-item lifecycle
 * route to gate permissions + drive notifications without a second
 * round-trip.
 */
export async function getBoqItemContext(
  itemId: string,
  projectId: string
): Promise<{
  itemId: string;
  boqId: string;
  boqTitle: string;
  boqCreatorId: string | null;
  orgId: string;
  projectId: string;
  phase: BoqItemPhase;
  clientEmail: string | null;
} | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    item_id: string;
    boq_id: string;
    boq_title: string;
    boq_created_by: string | null;
    org_id: string;
    project_id: string;
    phase: BoqItemPhase;
    client_email: string | null;
  }>(
    `SELECT
       bi.id           AS item_id,
       b.id            AS boq_id,
       b.title         AS boq_title,
       b.created_by    AS boq_created_by,
       p.org_id        AS org_id,
       p.id            AS project_id,
       bi.phase        AS phase,
       p.client_email  AS client_email
     FROM boq_item bi
     JOIN boq b ON b.id = bi.boq_id
     JOIN project p ON p.id = b.project_id
     WHERE bi.id = $1 AND b.project_id = $2`,
    [itemId, projectId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    itemId: r.item_id,
    boqId: r.boq_id,
    boqTitle: r.boq_title,
    boqCreatorId: r.boq_created_by,
    orgId: r.org_id,
    projectId: r.project_id,
    phase: r.phase,
    clientEmail: r.client_email,
  };
}

/** Confirm a BOQ section's parent BOQ belongs to the given project. */
export async function verifyBoqSectionOwnership(
  sectionId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM boq_section s
     JOIN boq b ON b.id = s.boq_id
     WHERE s.id = $1 AND b.project_id = $2`,
    [sectionId, projectId]
  );
  return rows.length > 0;
}

/** Confirm a BOQ item's parent BOQ belongs to the given project. */
export async function verifyBoqItemOwnership(
  itemId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM boq_item bi
     JOIN boq b ON b.id = bi.boq_id
     WHERE bi.id = $1 AND b.project_id = $2`,
    [itemId, projectId]
  );
  return rows.length > 0;
}

export interface CreateBoqInput {
  title: string;
  currency?: string;
  exchangeRate?: number;
  contingencyPct?: number;
  vatPct?: number;
  minimumMarginPct?: number;
  clientId?: string | null;
  architectId?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
  createdBy?: string | null;
}

/** Insert a new BOQ row for a project. Defaults: USD, 0% contingency/VAT, 10% minimum margin. */
export async function createBoq(
  projectId: string,
  input: CreateBoqInput
): Promise<Boq> {
  const pool = getPool();
  const { rows } = await pool.query<Boq>(
    `INSERT INTO boq (
       project_id, title, currency, exchange_rate,
       contingency_pct, vat_pct, minimum_margin_pct,
       client_id, architect_id, notes, client_notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      projectId,
      input.title,
      input.currency ?? "USD",
      input.exchangeRate ?? 1,
      input.contingencyPct ?? 0,
      input.vatPct ?? 0,
      input.minimumMarginPct ?? 10,
      input.clientId ?? null,
      input.architectId ?? null,
      input.notes ?? null,
      input.clientNotes ?? null,
      input.createdBy ?? null,
    ]
  );
  return rows[0];
}

/** Latest non-superseded BOQ for a project (highest version), or null if none exists. */
export async function getBoqByProject(projectId: string): Promise<Boq | null> {
  const pool = getPool();
  const { rows } = await pool.query<Boq>(
    `SELECT * FROM boq
     WHERE project_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [projectId]
  );
  return rows[0] ?? null;
}

/** Phases visible to client viewers — anything else is filtered out server-side. */
export const CLIENT_VISIBLE_PHASES: readonly BoqItemPhase[] = [
  "sent_to_client",
  "client_reviewing",
  "client_changes_requested",
  "client_approved",
];

/**
 * Promote any `sent_to_client` items in this BOQ to `client_reviewing`. Called
 * from the client read path before the SELECT — once a client opens the BOQ
 * the rows they see flip to `client_reviewing` so PM-side surfaces can tell
 * "sent but unseen" apart from "client is looking at it".
 *
 * Idempotent: rows already past `sent_to_client` are untouched.
 */
export async function bumpSentToClientToReviewing(
  boqId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE boq_item
       SET phase = 'client_reviewing'
     WHERE boq_id = $1
       AND phase = 'sent_to_client'`,
    [boqId]
  );
}

/**
 * Fetch a BOQ with its sections, items (with computed cost columns), and
 * rolled-up summary in one round-trip.
 *
 * When `viewerIsExternal` is true (client or vendor), only items in the
 * client-visible phase set are returned, AND every studio-internal
 * cost/margin field is scrubbed from the payload before it leaves the
 * server. Drafts and items still under internal review never leave the
 * studio.
 */
export async function getBoq(
  boqId: string,
  opts: { viewerIsExternal?: boolean; viewerIsClient?: boolean } = {}
): Promise<BoqWithDetails | null> {
  const pool = getPool();
  // Auto-bump sent_to_client → client_reviewing the first time a client
  // opens the BOQ. Vendors don't trigger this — they're external but not
  // the approving party. The bump piggybacks on the boq SELECT via a CTE
  // so client reads stay at one DB round-trip instead of two.
  const boqBumpCte = opts.viewerIsClient
    ? `WITH bump AS (
         UPDATE boq_item
            SET phase = 'client_reviewing'
          WHERE boq_id = $1
            AND phase = 'sent_to_client'
         RETURNING 1
       ) `
    : ``;
  const itemFilter = opts.viewerIsExternal
    ? `AND bi.phase = ANY($2::text[])`
    : ``;
  const itemParams: unknown[] = opts.viewerIsExternal
    ? [boqId, CLIENT_VISIBLE_PHASES]
    : [boqId];

  const [boqRes, sectionsRes, itemsRes, summary] = await Promise.all([
    pool.query<Boq>(`${boqBumpCte}SELECT b.* FROM boq b WHERE b.id = $1`, [
      boqId,
    ]),
    pool.query<BoqSection>(
      `SELECT * FROM boq_section WHERE boq_id = $1 ORDER BY sort_order, created_at`,
      [boqId]
    ),
    pool.query<BoqItemWithComputed>(
      `${ITEM_SELECT} WHERE bi.boq_id = $1 ${itemFilter} ORDER BY bi.sort_order, bi.created_at`,
      itemParams
    ),
    getBoqSummary(boqId),
  ]);

  if (boqRes.rows.length === 0) return null;

  const {
    boq,
    items,
    summary: scrubbedSummary,
  } = opts.viewerIsExternal
    ? scrubBoqForExternalViewer({
        boq: boqRes.rows[0],
        items: itemsRes.rows,
        summary,
      })
    : { boq: boqRes.rows[0], items: itemsRes.rows, summary };

  return {
    ...boq,
    sections: sectionsRes.rows,
    items,
    summary: scrubbedSummary,
  };
}

/**
 * Strip every studio-internal cost/margin/budget/notes field from a BOQ
 * payload. Sell-side fields (sell_price, client_rate, subtotal, vat,
 * client_total) stay — that's what the external viewer is billed.
 */
export function scrubBoqForExternalViewer(input: {
  boq: Boq;
  items: BoqItemWithComputed[];
  summary: BoqSummary;
}): {
  boq: Boq;
  items: BoqItemWithComputed[];
  summary: BoqSummary;
} {
  return {
    boq: { ...input.boq, notes: null },
    items: input.items.map((it) => ({
      ...it,
      unit_cost: "0",
      material_cost: null,
      labour_cost: null,
      overhead_pct: "0",
      service_charge_pct: "0",
      margin_pct: "0",
      budget_rate: null,
      notes: null,
      total_cost: "0",
      margin_alert: false,
      over_budget: false,
      budget_variance_pct: null,
    })),
    summary: {
      ...input.summary,
      total_cost: "0",
      average_margin_pct: "0",
      margin_bleed_count: 0,
      over_budget_count: 0,
      section_totals: input.summary.section_totals.map((s) => ({
        ...s,
        total_cost: "0",
      })),
    },
  };
}

export type UpdateBoqInput = Partial<Omit<CreateBoqInput, "createdBy">>;

const BOQ_COLS: Record<keyof UpdateBoqInput, string> = {
  title: "title",
  currency: "currency",
  exchangeRate: "exchange_rate",
  contingencyPct: "contingency_pct",
  vatPct: "vat_pct",
  minimumMarginPct: "minimum_margin_pct",
  clientId: "client_id",
  architectId: "architect_id",
  notes: "notes",
  clientNotes: "client_notes",
};

/** Patch any subset of BOQ header fields. Returns null if no fields were provided. */
export async function updateBoq(
  boqId: string,
  input: UpdateBoqInput
): Promise<Boq | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(BOQ_COLS) as [
    keyof UpdateBoqInput,
    string,
  ][]) {
    const val = input[key];
    if (val === undefined) continue;
    setClauses.push(`${col} = $${i++}`);
    values.push(val);
  }
  if (setClauses.length === 0) return null;
  setClauses.push(`updated_at = now()`);
  values.push(boqId);

  const pool = getPool();
  const { rows } = await pool.query<Boq>(
    `UPDATE boq SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

// ─── Internal review (Feature 4 — internal approval gate) ───────────────────

/**
 * Returns the set of user IDs eligible to approve / request changes on
 * this BOQ. The "4-eyes" rule excludes the creator — they can't sign
 * off on their own work.
 *
 * Eligible = PMs (org owner/admin) OR architects (org member), AND not
 * the BOQ creator. The set is used by:
 *   - the route guards (verifies the caller is in the set)
 *   - the submit-for-review notification fan-out
 *   - the UI to decide whether to show approve / request-changes buttons
 */
export async function getEligibleReviewers(opts: {
  orgId: string;
  creatorId: string | null;
}): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ userId: string }>(
    `SELECT DISTINCT m."userId"
     FROM member m
     WHERE m."organizationId" = $1
       AND m.role IN ('owner', 'admin', 'member')
       AND ($2::text IS NULL OR m."userId" <> $2)`,
    [opts.orgId, opts.creatorId]
  );
  return rows.map((r) => r.userId);
}

/**
 * Find the most recent change-request event for a single BOQ item — covers
 * both single-item audit rows (target_table='boq_item', target_id=$itemId)
 * and bulk rows (target_table='boq' with metadata.item_ids @> [$itemId]).
 *
 * Returns null when the item has never been kicked back. The drawer banner
 * uses this so a viewer can see the reason for the current
 * `*_changes_requested` phase.
 */
export async function getLatestBoqItemChangeRequest(
  itemId: string
): Promise<BoqItemChangeRequest | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    actor_id: string;
    actor_name: string | null;
    to_phase: BoqItemChangeRequest["to_phase"];
    comment: string | null;
    created_at: string;
  }>(
    `SELECT
       ae.actor_id,
       u.name AS actor_name,
       (ae.metadata ->> 'to')::text AS to_phase,
       NULLIF(ae.metadata ->> 'comment', '') AS comment,
       ae.created_at
     FROM audit_event ae
     LEFT JOIN "user" u ON u.id = ae.actor_id
     WHERE ae.action = 'boq.item.phase_changed'
       AND ae.metadata ->> 'to' IN ('internal_changes_requested', 'client_changes_requested')
       AND (
         (ae.target_table = 'boq_item' AND ae.target_id = $1::uuid)
         OR (
           ae.target_table = 'boq'
           AND ae.metadata @> jsonb_build_object('item_ids', jsonb_build_array($1::text))
         )
       )
     ORDER BY ae.created_at DESC
     LIMIT 1`,
    [itemId]
  );
  return rows[0] ?? null;
}

/**
 * Per-item phase-change timeline. Pulls both single-item audit rows
 * (`target_table='boq_item'`) AND bulk rows whose `metadata.item_ids`
 * contains this item id (`target_table='boq'`) — bulk rows attribute the
 * same event to every affected item.
 *
 * Actor role is derived per row from the org `member` row, with a client
 * override when the actor's email matches the project's `client_email`.
 * Old events whose actor has since left the org degrade to "pm" rather
 * than failing — the timeline is a viewer, not an authoritative source.
 *
 * Caller applies the external-viewer scrub. Kept out of the query so the
 * same fetch serves internal callers too.
 */
export async function getBoqItemHistory(opts: {
  itemId: string;
  boqId: string;
  orgId: string;
  clientEmail: string | null;
}): Promise<BoqItemHistoryEvent[]> {
  const { itemId, boqId, orgId, clientEmail } = opts;
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    actor_id: string;
    actor_name: string | null;
    actor_email: string | null;
    member_role: string | null;
    target_table: "boq_item" | "boq";
    metadata: {
      from?: string | null;
      to?: string | null;
      from_phase?: string | null;
      to_phase?: string | null;
      comment?: string | null;
      item_count?: number;
      item_ids?: string[];
      item_phases?: Record<string, string>;
    };
    created_at: string | Date;
  }>(
    `SELECT
       ae.id::text       AS id,
       ae.actor_id       AS actor_id,
       u.name            AS actor_name,
       u.email           AS actor_email,
       m.role            AS member_role,
       ae.target_table   AS target_table,
       ae.metadata       AS metadata,
       ae.created_at     AS created_at
     FROM audit_event ae
     LEFT JOIN "user" u ON u.id = ae.actor_id
     LEFT JOIN member m ON m."userId" = ae.actor_id AND m."organizationId" = ae.org_id
     WHERE ae.org_id = $3
       AND ae.action = 'boq.item.phase_changed'
       AND (
         (ae.target_table = 'boq_item' AND ae.target_id = $1::uuid)
         OR (
           ae.target_table = 'boq'
           AND ae.target_id = $2::uuid
           AND ae.metadata @> jsonb_build_object('item_ids', jsonb_build_array($1::text))
         )
       )
     ORDER BY ae.created_at DESC, ae.id DESC
     LIMIT 100`,
    [itemId, boqId, orgId]
  );

  // Single follow-up SELECT against boq_item for every id referenced by any
  // bulk row in the result set — feeds the "items in this batch" popover.
  // One round-trip regardless of how many bulk events the item has.
  const bulkItemIds = new Set<string>();
  for (const r of rows) {
    if (r.target_table === "boq" && Array.isArray(r.metadata.item_ids)) {
      for (const id of r.metadata.item_ids) bulkItemIds.add(id);
    }
  }
  const itemLookup = new Map<
    string,
    { id: string; item_code: string; description: string }
  >();
  if (bulkItemIds.size > 0) {
    const { rows: itemRows } = await pool.query<{
      id: string;
      item_code: string;
      description: string;
    }>(
      `SELECT id::text, item_code, description
       FROM boq_item
       WHERE id = ANY($1::uuid[])`,
      [Array.from(bulkItemIds)]
    );
    for (const it of itemRows) itemLookup.set(it.id, it);
  }

  const events: BoqItemHistoryEvent[] = [];
  for (const r of rows) {
    const isBulk = r.target_table === "boq";
    // Legacy audit rows (pre-lifecycle-8) used `from_phase`/`to_phase`
    // keys, then the migration rewrote values without renaming the keys.
    // New writers use `from`/`to`. Read either shape so the timeline
    // doesn't crash on rows that pre-date the current writer.
    const toRaw = r.metadata.to ?? r.metadata.to_phase ?? null;
    const fromRaw = isBulk
      ? (r.metadata.item_phases?.[itemId] ?? null)
      : (r.metadata.from ?? r.metadata.from_phase ?? null);
    const toPhase = asBoqItemPhase(toRaw);
    if (toPhase === null) continue;
    const role: UserRole =
      r.actor_email !== null &&
      clientEmail !== null &&
      r.actor_email === clientEmail
        ? "client"
        : memberRoleToUserRole(r.member_role);
    // Preserve the order recorded at write time; drop ids the lookup
    // couldn't resolve (e.g. items deleted since the bulk action).
    const bulkItems = isBulk
      ? (r.metadata.item_ids ?? [])
          .map((id) => itemLookup.get(id))
          .filter((it): it is NonNullable<typeof it> => it !== undefined)
      : null;
    events.push({
      id: r.id,
      actor_id: r.actor_id,
      actor_name: r.actor_name ?? "Someone",
      actor_role: role,
      from_phase: asBoqItemPhase(fromRaw),
      to_phase: toPhase,
      comment: r.metadata.comment ?? null,
      is_bulk: isBulk,
      bulk_item_count: isBulk ? (r.metadata.item_count ?? null) : null,
      bulk_items: bulkItems,
      created_at: toIso(r.created_at),
    });
  }
  return events;
}

/**
 * Project-scoped staff: every user with a `project_member` row on this
 * project whose role is `pm` or `architect`. Used by phase notifications so
 * the whole studio team on the project hears about a client decision (or a
 * kick-back), not just the BOQ's original creator.
 */
export async function getProjectStaffIds(projectId: string): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM project_member
     WHERE project_id = $1
       AND role IN ('pm', 'architect')`,
    [projectId]
  );
  return rows.map((r) => r.user_id);
}

export interface CreateBoqSectionInput {
  title: string;
  description?: string | null;
  sortOrder?: number;
  budgetCap?: number | null;
  isVisibleToClient?: boolean;
}

/** Insert a section under a BOQ. `sortOrder` defaults to the next available slot at the end. */
export async function createBoqSection(
  boqId: string,
  input: CreateBoqSectionInput
): Promise<BoqSection> {
  const pool = getPool();
  const { rows } = await pool.query<BoqSection>(
    `INSERT INTO boq_section (boq_id, title, description, sort_order, budget_cap, is_visible_to_client)
     VALUES ($1, $2, $3,
             COALESCE($4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM boq_section WHERE boq_id = $1)),
             $5, COALESCE($6, true))
     RETURNING *`,
    [
      boqId,
      input.title,
      input.description ?? null,
      input.sortOrder ?? null,
      input.budgetCap ?? null,
      input.isVisibleToClient ?? null,
    ]
  );
  return rows[0];
}

export type UpdateBoqSectionInput = Partial<CreateBoqSectionInput>;

const SECTION_COLS: Record<keyof UpdateBoqSectionInput, string> = {
  title: "title",
  description: "description",
  sortOrder: "sort_order",
  budgetCap: "budget_cap",
  isVisibleToClient: "is_visible_to_client",
};

/** Patch any subset of section fields. Returns null when there's nothing to update. */
export async function updateBoqSection(
  sectionId: string,
  input: UpdateBoqSectionInput
): Promise<BoqSection | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(SECTION_COLS) as [
    keyof UpdateBoqSectionInput,
    string,
  ][]) {
    const val = input[key];
    if (val === undefined) continue;
    setClauses.push(`${col} = $${i++}`);
    values.push(val);
  }
  if (setClauses.length === 0) return null;
  setClauses.push(`updated_at = now()`);
  values.push(sectionId);

  const pool = getPool();
  const { rows } = await pool.query<BoqSection>(
    `UPDATE boq_section SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

/**
 * Delete a section.
 *
 * - `cascade = false` (default) — items in the section survive; their
 *   `section_id` flips to NULL via the FK's `ON DELETE SET NULL`, moving
 *   them into the Unassigned bucket.
 * - `cascade = true` — items in the section are deleted in the same
 *   transaction. Used by the "Delete section + all items" path, which
 *   the UI gates behind a type-to-confirm prompt.
 */
export async function deleteBoqSection(
  sectionId: string,
  cascade = false
): Promise<boolean> {
  const pool = getPool();
  if (!cascade) {
    const { rowCount } = await pool.query(
      `DELETE FROM boq_section WHERE id = $1`,
      [sectionId]
    );
    return (rowCount ?? 0) > 0;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM boq_item WHERE section_id = $1`, [
      sectionId,
    ]);
    const { rowCount } = await client.query(
      `DELETE FROM boq_section WHERE id = $1`,
      [sectionId]
    );
    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Reorder sections within a BOQ. All IDs must belong to the same BOQ. */
export async function reorderBoqSections(
  boqId: string,
  orderedIds: string[]
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE boq_section
     SET sort_order = data.pos, updated_at = now()
     FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
     WHERE boq_section.id = data.id AND boq_section.boq_id = $3`,
    [orderedIds, orderedIds.length - 1, boqId]
  );
}

export interface CreateBoqItemInput {
  sectionId?: string | null;
  elementId?: string | null;
  /** Provenance — set by the create flow, not user-editable. Defaults to 'custom'. */
  source?: BoqItemSource;
  rateContractItemId?: string | null;
  itemCode?: string;
  /** Pre-trimmed by the Zod schema. Pass `null` to clear. */
  name?: string | null;
  description: string;
  unit: string;
  quantity?: number;
  unitCost?: number;
  materialCost?: number | null;
  labourCost?: number | null;
  overheadPct?: number;
  serviceChargePct?: number;
  marginPct?: number;
  clientRate?: number | null;
  budgetRate?: number | null;
  /** Per-line physical dimensions. Stored in `dimensionUnit` (default 'm'). */
  length?: number | null;
  breadth?: number | null;
  height?: number | null;
  /** 'm' = decimal metres; 'ft' = decimal feet (UI parses 7'10" notation). */
  dimensionUnit?: "m" | "ft";
  notes?: string | null;
  clientNotes?: string | null;
  sortOrder?: number;
  isProvisional?: boolean;
  isExcluded?: boolean;
}

/** Insert a BOQ item, auto-generating its `item_code` from the org sequence when none is supplied. */
export async function createBoqItem(
  boqId: string,
  orgId: string,
  input: CreateBoqItemInput
): Promise<BoqItemWithComputed> {
  const itemCode = input.itemCode?.trim()
    ? input.itemCode.trim()
    : await getNextSequenceNumber(orgId, "BOQ");

  const pool = getPool();
  // Explicit ::numeric / ::int casts on numeric placeholders. Without them
  // pg infers the type from `COALESCE($N, 0)` as INTEGER (because the literal
  // `0` is INTEGER) and rejects fractional values like "2.5".
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH inserted AS (
       INSERT INTO boq_item (
         boq_id, section_id, element_id, source, rate_contract_item_id,
         item_code, name, description, unit,
         quantity, unit_cost, material_cost, labour_cost,
         overhead_pct, service_charge_pct, margin_pct,
         client_rate, budget_rate,
         length, breadth, height, dimension_unit,
         notes, client_notes,
         sort_order, is_provisional, is_excluded
       ) VALUES (
         $1, $2::uuid, $3, COALESCE($4, 'custom'), $5::uuid,
         $6, $7, $8, $9,
         COALESCE($10::numeric, 0), COALESCE($11::numeric, 0), $12::numeric, $13::numeric,
         COALESCE($14::numeric, 0), COALESCE($15::numeric, 0), COALESCE($16::numeric, 0),
         $17::numeric, $18::numeric,
         $19::numeric, $20::numeric, $21::numeric, COALESCE($22, 'm'),
         $23, $24,
         COALESCE($25::int, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM boq_item WHERE boq_id = $1 AND section_id IS NOT DISTINCT FROM $2::uuid)),
         COALESCE($26, false), COALESCE($27, false)
       )
       RETURNING *
     )
     SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS}
     FROM inserted bi
     JOIN boq b ON b.id = bi.boq_id
     ${ITEM_LIBRARY_JOIN}`,
    [
      boqId,
      input.sectionId ?? null,
      input.elementId ?? null,
      input.source ?? null,
      input.rateContractItemId ?? null,
      itemCode,
      input.name || null,
      input.description,
      input.unit,
      input.quantity ?? null,
      input.unitCost ?? null,
      input.materialCost ?? null,
      input.labourCost ?? null,
      input.overheadPct ?? null,
      input.serviceChargePct ?? null,
      input.marginPct ?? null,
      input.clientRate ?? null,
      input.budgetRate ?? null,
      input.length ?? null,
      input.breadth ?? null,
      input.height ?? null,
      input.dimensionUnit ?? null,
      input.notes ?? null,
      input.clientNotes ?? null,
      input.sortOrder ?? null,
      input.isProvisional ?? null,
      input.isExcluded ?? null,
    ]
  );
  return rows[0];
}

export interface UpdateBoqItemInput {
  sectionId?: string | null;
  itemCode?: string;
  name?: string | null;
  description?: string;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  materialCost?: number | null;
  labourCost?: number | null;
  overheadPct?: number;
  serviceChargePct?: number;
  marginPct?: number;
  clientRate?: number | null;
  budgetRate?: number | null;
  length?: number | null;
  breadth?: number | null;
  height?: number | null;
  dimensionUnit?: "m" | "ft";
  installedQty?: number;
  notes?: string | null;
  clientNotes?: string | null;
  sortOrder?: number;
  isProvisional?: boolean;
  isExcluded?: boolean;
}

const ITEM_COLS: Record<keyof UpdateBoqItemInput, string> = {
  sectionId: "section_id",
  itemCode: "item_code",
  name: "name",
  description: "description",
  unit: "unit",
  quantity: "quantity",
  unitCost: "unit_cost",
  materialCost: "material_cost",
  labourCost: "labour_cost",
  overheadPct: "overhead_pct",
  serviceChargePct: "service_charge_pct",
  marginPct: "margin_pct",
  clientRate: "client_rate",
  budgetRate: "budget_rate",
  length: "length",
  breadth: "breadth",
  height: "height",
  dimensionUnit: "dimension_unit",
  installedQty: "installed_qty",
  notes: "notes",
  clientNotes: "client_notes",
  sortOrder: "sort_order",
  isProvisional: "is_provisional",
  isExcluded: "is_excluded",
};

/**
 * Fields that represent a material change to a client-approved item.
 * Editing any of these auto-flips `phase = 'client_approved'` back to
 * `sent_to_client` so the client re-decides on the fresh value.
 */
const REAPPROVAL_FIELDS = new Set<keyof UpdateBoqItemInput>([
  "description",
  "unit",
  "quantity",
  "unitCost",
  "materialCost",
  "labourCost",
  "overheadPct",
  "serviceChargePct",
  "marginPct",
  // The client signs off on `clientRate` directly — re-approval if it
  // changes. `budgetRate` is internal-only and does NOT trigger re-approval.
  "clientRate",
  "sectionId",
  // Physical dimensions are material — changing a footing from
  // 2.5×1.5×0.5 to 3×2×1 is a re-approval-worthy change. Drawer edits
  // already patch `quantity` alongside the dimension and would trigger
  // via that path, but keep these listed defensively so a direct API
  // patch of just `length` (etc.) still flips the row to pending.
  "length",
  "breadth",
  "height",
]);

export type UpdateBoqItemOutcome =
  | { ok: true; item: BoqItemWithComputed }
  | { ok: false; reason: "not_found" | "conflict" };

/**
 * Update a BOQ item with optimistic locking via `updated_at`.
 *
 * If the item is currently in phase `client_approved` and the caller edits
 * any material field (cost / description / section / dimensions / clientRate),
 * the phase auto-flips back to `sent_to_client` — the client sees the
 * fresh value in their queue on next visit. No notification fires for this
 * implicit transition.
 *
 * Returns:
 * - `{ ok: true, item }` on success
 * - `{ ok: false, reason: "conflict" }` on stale `updated_at` (→ 409)
 * - `{ ok: false, reason: "not_found" }` if the row doesn't exist
 */
export async function updateBoqItem(
  itemId: string,
  expectedUpdatedAt: string,
  input: UpdateBoqItemInput
): Promise<UpdateBoqItemOutcome> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  let changedMaterialField = false;

  for (const [key, col] of Object.entries(ITEM_COLS) as [
    keyof UpdateBoqItemInput,
    string,
  ][]) {
    const val = input[key];
    if (val === undefined) continue;
    setClauses.push(`${col} = $${i++}`);
    values.push(val);
    if (REAPPROVAL_FIELDS.has(key)) changedMaterialField = true;
  }

  if (setClauses.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  if (changedMaterialField) {
    setClauses.push(
      `phase = CASE WHEN phase = 'client_approved' THEN 'sent_to_client' ELSE phase END`
    );
  }

  setClauses.push(`updated_at = now()`);

  // `pg` deserializes TIMESTAMPTZ into JS Date (ms precision), so the
  // round-tripped token loses the row's microseconds. Truncate both sides.
  const pool = getPool();
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH updated AS (
       UPDATE boq_item bi
       SET ${setClauses.join(", ")}
       WHERE bi.id = $${i}
         AND date_trunc('milliseconds', bi.updated_at)
             = date_trunc('milliseconds', $${i + 1}::timestamptz)
       RETURNING *
     )
     SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS}
     FROM updated bi
     JOIN boq b ON b.id = bi.boq_id
     ${ITEM_LIBRARY_JOIN}`,
    [...values, itemId, expectedUpdatedAt]
  );

  if (rows.length > 0) return { ok: true, item: rows[0] };

  // 0 rows updated — either the row doesn't exist, or updated_at drifted.
  const exists = await pool.query(`SELECT 1 FROM boq_item WHERE id = $1`, [
    itemId,
  ]);
  return {
    ok: false,
    reason: exists.rows.length > 0 ? "conflict" : "not_found",
  };
}

export type DeleteBoqItemOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "conflict" };

export type MoveBoqItemOutcome =
  | { ok: true; item: BoqItemWithComputed }
  | { ok: false; reason: "not_found" | "conflict" | "wrong_boq" };

/**
 * Move a BOQ item to a different section in the same BOQ.
 * `targetSectionId = null` moves it to the Unassigned bucket
 * (`boq_item.section_id IS NULL`).
 *
 * - Validates a UUID target belongs to the same BOQ as the item.
 *   Cross-BOQ moves are rejected — they'd break cost / version semantics.
 * - Appends to the bottom of the target bucket
 *   (`sort_order = COALESCE(MAX, -1) + 1`). Source-section gaps are not
 *   reclaimed (cheap to ignore; mirrors delete).
 * - Optimistic lock via `updated_at`, same scheme as `updateBoqItem`.
 *
 * Returns the full row (with computed cost columns) on success so SWR
 * can patch the cache without a refetch.
 */
export async function moveBoqItem(
  itemId: string,
  targetSectionId: string | null,
  expectedUpdatedAt: string
): Promise<MoveBoqItemOutcome> {
  const pool = getPool();

  if (targetSectionId !== null) {
    // Verify the target section belongs to the same BOQ as the item.
    // Distinct from "not found" so the caller can return a useful error.
    const { rows: matchRows } = await pool.query(
      `SELECT 1 FROM boq_section bs
       JOIN boq_item bi ON bi.boq_id = bs.boq_id
       WHERE bs.id = $1 AND bi.id = $2`,
      [targetSectionId, itemId]
    );
    if (matchRows.length === 0) {
      const itemCheck = await pool.query(
        `SELECT 1 FROM boq_item WHERE id = $1`,
        [itemId]
      );
      return {
        ok: false,
        reason: itemCheck.rows.length === 0 ? "not_found" : "wrong_boq",
      };
    }
  }

  // Move with optimistic locking; compute the new sort_order in-line.
  // `IS NOT DISTINCT FROM` makes the equality null-safe for the Unassigned
  // bucket. Two concurrent moves to the same target can pick the same MAX,
  // which just produces a sort_order tie — ORDER BY (sort_order, created_at)
  // breaks ties deterministically downstream, so we accept it.
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH updated AS (
       UPDATE boq_item bi
       SET section_id = $1,
           sort_order = COALESCE(
             (SELECT MAX(sort_order) FROM boq_item
              WHERE boq_id = bi.boq_id
                AND section_id IS NOT DISTINCT FROM $1::uuid),
             -1
           ) + 1,
           updated_at = now()
       WHERE bi.id = $2
         AND date_trunc('milliseconds', bi.updated_at)
             = date_trunc('milliseconds', $3::timestamptz)
       RETURNING *
     )
     SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS}
     FROM updated bi
     JOIN boq b ON b.id = bi.boq_id
     ${ITEM_LIBRARY_JOIN}`,
    [targetSectionId, itemId, expectedUpdatedAt]
  );

  if (rows.length > 0) return { ok: true, item: rows[0] };
  return { ok: false, reason: "conflict" };
}

/** Delete a BOQ item with optimistic locking via `updated_at`. */
export async function deleteBoqItem(
  itemId: string,
  expectedUpdatedAt: string
): Promise<DeleteBoqItemOutcome> {
  // See `updateBoqItem` above for why the comparison truncates to ms.
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM boq_item
     WHERE id = $1
       AND date_trunc('milliseconds', updated_at)
           = date_trunc('milliseconds', $2::timestamptz)`,
    [itemId, expectedUpdatedAt]
  );
  if ((rowCount ?? 0) > 0) return { ok: true };

  const exists = await pool.query(`SELECT 1 FROM boq_item WHERE id = $1`, [
    itemId,
  ]);
  return {
    ok: false,
    reason: exists.rows.length > 0 ? "conflict" : "not_found",
  };
}

/** Reorder items within a section (or the BOQ root if sectionId is null). */
export async function reorderBoqItems(
  boqId: string,
  sectionId: string | null,
  orderedIds: string[]
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE boq_item
     SET sort_order = data.pos, updated_at = now()
     FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
     WHERE boq_item.id = data.id
       AND boq_item.boq_id = $3
       AND boq_item.section_id IS NOT DISTINCT FROM $4::uuid`,
    [orderedIds, orderedIds.length - 1, boqId, sectionId]
  );
}

/**
 * Snapshot a library element's costs into a new BOQ item. Returns null if the
 * element no longer exists. When `rateContractItemId` is supplied the unit
 * cost comes from the rate-contract row (rather than the element default) and
 * the BOQ item's source is `'rate_contract'`.
 */
export async function addElementToBoq(
  boqId: string,
  orgId: string,
  params: {
    sectionId: string | null;
    elementId: string;
    quantity?: number;
    rateContractItemId?: string;
  }
): Promise<BoqItemWithComputed | null> {
  const pool = getPool();
  const { rows: elementRows } = await pool.query(
    `SELECT code, name, description, unit, unit_cost, material_cost, labour_cost,
            overhead_pct, service_charge_pct, margin_pct, client_rate, budget_rate
     FROM element WHERE id = $1`,
    [params.elementId]
  );
  if (elementRows.length === 0) return null;
  const e = elementRows[0];

  let unitCost = Number(e.unit_cost);
  let unit: string = e.unit;
  let source: BoqItemSource = "library";

  if (params.rateContractItemId) {
    const { rows: rcRows } = await pool.query(
      `WITH RECURSIVE elem AS (
         SELECT category_id FROM element WHERE id = $3
       ),
       anc AS (
         SELECT ec.id, ec.parent_id
           FROM element_category ec
           JOIN elem ON elem.category_id = ec.id
         UNION ALL
         SELECT p.id, p.parent_id
           FROM element_category p
           JOIN anc ON p.id = anc.parent_id
       )
       SELECT rci.rate, rci.unit
         FROM rate_contract_item rci
         JOIN rate_contract rc ON rc.id = rci.rate_contract_id
        WHERE rci.id = $1
          AND rc.org_id = $2
          AND rc.status = 'active'
          AND (
            rci.element_id = $3
            OR (rci.element_id IS NULL AND rci.category_id IN (SELECT id FROM anc))
          )`,
      [params.rateContractItemId, orgId, params.elementId]
    );
    if (rcRows.length === 0) {
      throw new Error(
        "Rate contract item not active or doesn't cover the chosen element"
      );
    }
    unitCost = Number(rcRows[0].rate);
    unit = rcRows[0].unit;
    source = "rate_contract";
  }

  return createBoqItem(boqId, orgId, {
    sectionId: params.sectionId,
    elementId: params.elementId,
    source,
    rateContractItemId: params.rateContractItemId ?? null,
    itemCode: e.code,
    description: e.description || e.name,
    unit,
    quantity: params.quantity ?? 1,
    unitCost,
    materialCost: e.material_cost !== null ? Number(e.material_cost) : null,
    labourCost: e.labour_cost !== null ? Number(e.labour_cost) : null,
    overheadPct: e.overhead_pct !== null ? Number(e.overhead_pct) : 0,
    serviceChargePct:
      e.service_charge_pct !== null ? Number(e.service_charge_pct) : 0,
    marginPct: e.margin_pct !== null ? Number(e.margin_pct) : 0,
    // Library default-flow: copy rates onto the line. The line can be
    // edited independently after — changing one doesn't ripple to the
    // library element or vice versa. `!= null` (loose) so an undefined
    // (e.g. a test mock that omits the column) is treated as missing.
    clientRate: e.client_rate != null ? Number(e.client_rate) : null,
    budgetRate: e.budget_rate != null ? Number(e.budget_rate) : null,
  });
}

/**
 * Batch variant of {@link addElementToBoq} — same per-row semantics, but
 * called inside a single query loop so the caller can present a single
 * "Add N to BoQ" action. Returns `null` when ANY element id doesn't
 * resolve so the UI can surface a single error rather than partial
 * insertion. (Each insert is autocommitted because the underlying
 * `createBoqItem` doesn't expose a client transaction; if a later row
 * fails after earlier rows succeeded, this function still returns
 * `null` and the caller can refetch — the partially-added rows are
 * consistent on their own and the user can retry the missing ones.)
 */
export async function addElementsToBoq(
  boqId: string,
  orgId: string,
  params: {
    sectionId: string | null;
    items: Array<{
      elementId: string;
      quantity?: number;
      rateContractItemId?: string;
    }>;
  }
): Promise<BoqItemWithComputed[] | null> {
  const created: BoqItemWithComputed[] = [];
  for (const item of params.items) {
    const inserted = await addElementToBoq(boqId, orgId, {
      sectionId: params.sectionId,
      elementId: item.elementId,
      quantity: item.quantity,
      rateContractItemId: item.rateContractItemId,
    });
    if (!inserted) return null;
    created.push(inserted);
  }
  return created;
}

export type MoveBoqItemsBulkOutcome =
  | { ok: true; items: BoqItemWithComputed[] }
  | { ok: false; reason: "not_found" | "wrong_boq" };

/**
 * Move many BOQ items to a different section in the same BOQ in one
 * transaction. `targetSectionId = null` targets the Unassigned bucket.
 *
 * - Every `itemId` must belong to `boqId` — caller (route) already
 *   validated `boqId` via `parseBoqRequest`, so we only need to
 *   double-check the items.
 * - Items receive successive `sort_order` values starting at
 *   `MAX(target_bucket.sort_order) + 1`, in the order the caller
 *   supplied them.
 * - No per-row optimistic locking — bulk operations are explicit user
 *   intent and forcing the client to ship N `updated_at` tokens would
 *   make the UI fragile. The bulk-move atomic step + SWR revalidate
 *   covers the staleness window in practice.
 */
export async function moveBoqItemsBulk(
  itemIds: string[],
  boqId: string,
  targetSectionId: string | null
): Promise<MoveBoqItemsBulkOutcome> {
  if (itemIds.length === 0) return { ok: true, items: [] };

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Confirm every itemId exists in this BOQ.
    const { rows: countRows } = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM boq_item
       WHERE id = ANY($1::uuid[]) AND boq_id = $2`,
      [itemIds, boqId]
    );
    if (countRows[0].c !== itemIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }

    // 2. Confirm the target section (if any) is in this BOQ.
    if (targetSectionId !== null) {
      const { rows: sectionRows } = await client.query(
        `SELECT 1 FROM boq_section WHERE id = $1 AND boq_id = $2`,
        [targetSectionId, boqId]
      );
      if (sectionRows.length === 0) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "wrong_boq" };
      }
    }

    // 3. Compute the starting sort_order in the target bucket.
    //    Null-safe equality via IS NOT DISTINCT FROM.
    const { rows: sortRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM boq_item
       WHERE boq_id = $1 AND section_id IS NOT DISTINCT FROM $2::uuid`,
      [boqId, targetSectionId]
    );
    const baseSort = sortRows[0].next;

    // 4. Move all items in one statement. `array_position` is 1-based,
    //    so the first item gets baseSort, second baseSort+1, etc.
    await client.query(
      `UPDATE boq_item
       SET section_id = $1,
           sort_order = $2 + array_position($3::uuid[], id) - 1,
           updated_at = now()
       WHERE id = ANY($3::uuid[])`,
      [targetSectionId, baseSort, itemIds]
    );

    // 5. Re-fetch the moved rows with computed columns, in the same
    //    order the caller passed them in (so SWR cache merges cleanly).
    const { rows } = await client.query<BoqItemWithComputed>(
      `${ITEM_SELECT}
       WHERE bi.id = ANY($1::uuid[])
       ORDER BY array_position($1::uuid[], bi.id)`,
      [itemIds]
    );

    await client.query("COMMIT");
    return { ok: true, items: rows };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete many BOQ items in one statement. `boqId` scopes the delete so
 * a forged itemId list can't reach into other projects' BOQs. Returns
 * the number of rows actually removed.
 */
export async function deleteBoqItemsBulk(
  itemIds: string[],
  boqId: string
): Promise<number> {
  if (itemIds.length === 0) return 0;
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM boq_item WHERE id = ANY($1::uuid[]) AND boq_id = $2`,
    [itemIds, boqId]
  );
  return rowCount ?? 0;
}

/** Sources allowed to transition INTO each target phase. Pre-computed once. */
const PHASE_SOURCES: Record<BoqItemPhase, BoqItemPhase[]> = (() => {
  const out = {} as Record<BoqItemPhase, BoqItemPhase[]>;
  for (const phase of Object.keys(
    BOQ_ITEM_PHASE_TRANSITIONS
  ) as BoqItemPhase[]) {
    out[phase] = [];
  }
  for (const [src, dests] of Object.entries(BOQ_ITEM_PHASE_TRANSITIONS) as [
    BoqItemPhase,
    BoqItemPhase[],
  ][]) {
    for (const dst of dests) out[dst].push(src);
  }
  return out;
})();

export type SetPhaseOutcome =
  | { ok: true; item: BoqItemWithComputed }
  | {
      ok: false;
      reason: "not_found" | "invalid_transition";
      from?: BoqItemPhase;
    };

export type SetPhaseBulkOutcome =
  | {
      ok: true;
      items: BoqItemWithComputed[];
      /**
       * Per-item source phase, keyed by item id — used to record bulk audit
       * history so the per-item timeline can show each item's own from→to.
       */
      fromPhases: Record<string, BoqItemPhase>;
    }
  | {
      ok: false;
      reason: "not_found" | "wrong_boq" | "invalid_transition";
      blockedIds?: string[];
    };

/**
 * Move a single BOQ item to a new phase.
 *
 * Validates the source→target transition against `BOQ_ITEM_PHASE_TRANSITIONS`.
 * On `sent_to_client` entry stamps `sent_to_client_at`; on any client
 * decision (`client_approved`, `client_changes_requested`, or PM pull-back
 * via `internal_changes_requested` from a client-visible phase) stamps
 * `client_decided_at`.
 *
 * Routes are responsible for the actor-level permission check (who can
 * fire which transition). This query enforces only the state machine.
 */
export async function setBoqItemPhase(
  itemId: string,
  target: BoqItemPhase
): Promise<SetPhaseOutcome> {
  const allowedSources = PHASE_SOURCES[target];
  const pool = getPool();
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH updated AS (
       UPDATE boq_item bi
       SET phase = $2::text,
           sent_to_client_at = CASE
             WHEN $2::text = 'sent_to_client' THEN now()
             ELSE bi.sent_to_client_at
           END,
           client_decided_at = CASE
             WHEN $2::text IN ('client_approved', 'client_changes_requested') THEN now()
             WHEN $2::text = 'internal_changes_requested'
                  AND bi.phase IN ('sent_to_client', 'client_reviewing', 'client_changes_requested', 'client_approved')
               THEN now()
             ELSE bi.client_decided_at
           END,
           updated_at = now()
       WHERE bi.id = $1 AND bi.phase = ANY($3::text[])
       RETURNING *
     )
     SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS}
     FROM updated bi
     JOIN boq b ON b.id = bi.boq_id
     ${ITEM_LIBRARY_JOIN}`,
    [itemId, target, allowedSources]
  );

  if (rows.length > 0) return { ok: true, item: rows[0] };

  // 0 rows updated — disambiguate: missing row vs. wrong source phase.
  const probe = await pool.query<{ phase: BoqItemPhase }>(
    `SELECT phase FROM boq_item WHERE id = $1`,
    [itemId]
  );
  if (probe.rows.length === 0) return { ok: false, reason: "not_found" };
  return {
    ok: false,
    reason: "invalid_transition",
    from: probe.rows[0].phase,
  };
}

/**
 * Move many BOQ items to the same target phase in a single transaction.
 *
 * All items must (a) belong to the given BOQ and (b) have a current phase
 * that's a valid source for the target. If any item fails either check, the
 * whole batch rolls back and the caller gets the offending ids back.
 */
export async function setBoqItemsPhase(
  itemIds: string[],
  boqId: string,
  target: BoqItemPhase
): Promise<SetPhaseBulkOutcome> {
  if (itemIds.length === 0) return { ok: true, items: [], fromPhases: {} };

  const allowedSources = PHASE_SOURCES[target];
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Confirm every id is in this BOQ.
    const { rows: ownership } = await client.query<{
      id: string;
      phase: BoqItemPhase;
    }>(
      `SELECT id, phase FROM boq_item
       WHERE id = ANY($1::uuid[]) AND boq_id = $2`,
      [itemIds, boqId]
    );
    if (ownership.length !== itemIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "wrong_boq" };
    }

    // 2. Verify each current phase supports the target transition.
    const blocked = ownership
      .filter((r) => !allowedSources.includes(r.phase))
      .map((r) => r.id);
    if (blocked.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_transition", blockedIds: blocked };
    }

    // 3. Apply the transition in one statement.
    await client.query(
      `UPDATE boq_item
       SET phase = $2::text,
           sent_to_client_at = CASE
             WHEN $2::text = 'sent_to_client' THEN now()
             ELSE sent_to_client_at
           END,
           client_decided_at = CASE
             WHEN $2::text IN ('client_approved', 'client_changes_requested') THEN now()
             WHEN $2::text = 'internal_changes_requested'
                  AND phase IN ('sent_to_client', 'client_reviewing', 'client_changes_requested', 'client_approved')
               THEN now()
             ELSE client_decided_at
           END,
           updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [itemIds, target]
    );

    // 4. Return fresh rows with computed cost columns, preserving input order.
    const { rows } = await client.query<BoqItemWithComputed>(
      `${ITEM_SELECT}
       WHERE bi.id = ANY($1::uuid[])
       ORDER BY array_position($1::uuid[], bi.id)`,
      [itemIds]
    );

    const fromPhases: Record<string, BoqItemPhase> = {};
    for (const r of ownership) fromPhases[r.id] = r.phase;

    await client.query("COMMIT");
    return { ok: true, items: rows, fromPhases };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Aggregate cost/sell/margin/approval totals plus per-section subtotals for a BOQ in one query batch. */
export async function getBoqSummary(boqId: string): Promise<BoqSummary> {
  const pool = getPool();
  const [boqRes, aggRes, sectionRes] = await Promise.all([
    pool.query(`SELECT contingency_pct, vat_pct FROM boq WHERE id = $1`, [
      boqId,
    ]),
    pool.query(
      `SELECT
         COALESCE(SUM(bi.quantity * bi.unit_cost), 0) AS total_cost,
         COALESCE(SUM(
           bi.quantity * bi.unit_cost
           * (1 + COALESCE(bi.overhead_pct, 0)/100)
           * (1 + COALESCE(bi.service_charge_pct, 0)/100)
           * (1 + bi.margin_pct/100)
         ) FILTER (WHERE NOT bi.is_excluded), 0) AS total_sell_price,
         COALESCE(AVG(bi.margin_pct) FILTER (WHERE NOT bi.is_excluded), 0) AS average_margin_pct,
         COUNT(*) FILTER (WHERE bi.margin_pct < b.minimum_margin_pct AND NOT bi.is_excluded) AS margin_bleed_count,
         COUNT(*) FILTER (WHERE bi.phase IN ('internal_review', 'sent_to_client', 'client_reviewing')) AS pending_approvals,
         COUNT(*) FILTER (
           WHERE bi.budget_rate IS NOT NULL
             AND bi.budget_rate > 0
             AND bi.unit_cost > bi.budget_rate
             AND NOT bi.is_excluded
         ) AS over_budget_count,
         COUNT(*) AS item_count
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       WHERE bi.boq_id = $1`,
      [boqId]
    ),
    pool.query(
      `SELECT
         bi.section_id,
         s.title AS section_title,
         COALESCE(SUM(bi.quantity * bi.unit_cost), 0) AS total_cost,
         COALESCE(SUM(
           bi.quantity * bi.unit_cost
           * (1 + COALESCE(bi.overhead_pct, 0)/100)
           * (1 + COALESCE(bi.service_charge_pct, 0)/100)
           * (1 + bi.margin_pct/100)
         ) FILTER (WHERE NOT bi.is_excluded), 0) AS total_sell_price,
         COUNT(*) AS item_count
       FROM boq_item bi
       LEFT JOIN boq_section s ON s.id = bi.section_id
       WHERE bi.boq_id = $1
       GROUP BY bi.section_id, s.title, s.sort_order
       ORDER BY s.sort_order NULLS LAST, s.title`,
      [boqId]
    ),
  ]);

  const contingencyPct = Number(boqRes.rows[0]?.contingency_pct ?? 0);
  const vatPct = Number(boqRes.rows[0]?.vat_pct ?? 0);
  const agg = aggRes.rows[0] ?? {};
  const subtotal = Number(agg.total_sell_price ?? 0);
  const preVat = subtotal * (1 + contingencyPct / 100);
  const clientTotal = preVat * (1 + vatPct / 100);

  return {
    total_cost: String(agg.total_cost ?? 0),
    total_sell_price: String(agg.total_sell_price ?? 0),
    subtotal: String(subtotal),
    pre_vat_total: String(preVat),
    client_total: String(clientTotal),
    average_margin_pct: String(agg.average_margin_pct ?? 0),
    margin_bleed_count: Number(agg.margin_bleed_count ?? 0),
    pending_approvals: Number(agg.pending_approvals ?? 0),
    over_budget_count: Number(agg.over_budget_count ?? 0),
    item_count: Number(agg.item_count ?? 0),
    section_totals: sectionRes.rows.map((r) => ({
      section_id: r.section_id,
      section_title: r.section_title,
      total_cost: String(r.total_cost),
      total_sell_price: String(r.total_sell_price ?? 0),
      item_count: Number(r.item_count),
    })),
  };
}

/**
 * Atomically increment (or create) the counter for `(orgId, prefix, year)` and
 * return a formatted sequence string like `BOQ-2026-001`.
 */
export async function getNextSequenceNumber(
  orgId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const pool = getPool();
  const { rows } = await pool.query<{ current_value: number }>(
    `INSERT INTO sequence_counter (org_id, prefix, year, current_value)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (org_id, prefix, year)
     DO UPDATE SET current_value = sequence_counter.current_value + 1
     RETURNING current_value`,
    [orgId, prefix, year]
  );
  const n = rows[0].current_value;
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

// ── BOQ Excel Import (Feature 6) ────────────────────────────────────────────

/**
 * Bulk-advance the sequence counter and return N formatted codes in order.
 *
 * Runs against a transaction `client` (not the pool) so a ROLLBACK in the
 * surrounding import reverses the sequence advance. Otherwise a partially-
 * applied import would burn codes permanently and leave gaps that show up on
 * client-facing invoices.
 */
export async function nextSequenceNumbers(
  client: PoolClient,
  orgId: string,
  prefix: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const year = new Date().getUTCFullYear();
  const { rows } = await client.query<{ current_value: number }>(
    `INSERT INTO sequence_counter (org_id, prefix, year, current_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, prefix, year)
     DO UPDATE SET current_value = sequence_counter.current_value + $4::int
     RETURNING current_value`,
    [orgId, prefix, year, count]
  );
  const end = rows[0].current_value;
  const start = end - count + 1;
  return Array.from(
    { length: count },
    (_, i) => `${prefix}-${year}-${String(start + i).padStart(3, "0")}`
  );
}

/**
 * Build a lookup from `element.code` → { id, code, name } for the org,
 * limited to the latest active version per code group. Used by the import
 * preview to auto-link incoming rows to existing elements.
 */
export async function getElementsByCodeMap(
  orgId: string
): Promise<Map<string, BoqElementLite>> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    code: string;
    name: string;
  }>(
    `SELECT DISTINCT ON (code) id, code, name
       FROM element
      WHERE org_id = $1 AND is_active = true
      ORDER BY code, version_number DESC`,
    [orgId]
  );
  const map = new Map<string, BoqElementLite>();
  for (const r of rows) map.set(r.code, r);
  return map;
}

/**
 * Lightweight read for the export writer — items + sections only, no
 * `getBoqSummary`. The writer doesn't render summary aggregates; computing
 * them on every export wastes 3 queries (margin avg, totals, group-by).
 */
export async function getBoqForExport(boqId: string): Promise<{
  items: BoqItemWithComputed[];
  sections: BoqSection[];
} | null> {
  const pool = getPool();
  const [boqRes, itemsRes, sectionsRes] = await Promise.all([
    pool.query<{ id: string }>(`SELECT id FROM boq WHERE id = $1`, [boqId]),
    pool.query<BoqItemWithComputed>(
      `${ITEM_SELECT} WHERE bi.boq_id = $1 ORDER BY bi.sort_order, bi.created_at`,
      [boqId]
    ),
    pool.query<BoqSection>(
      `SELECT * FROM boq_section WHERE boq_id = $1 ORDER BY sort_order, created_at`,
      [boqId]
    ),
  ]);
  if (boqRes.rows.length === 0) return null;
  return { items: itemsRes.rows, sections: sectionsRes.rows };
}

/**
 * Fetch everything needed for the "sent to client" PDF + email in two
 * parallel round-trips: BOQ header (title, currency, vat_pct) + project
 * (name, client_email) in one, the moved items (with computed totals +
 * section titles) in the other. `itemIds` is scoped to the caller's
 * `boqId` so a forged list can't leak rows from another BOQ.
 *
 * Returns `null` when the BOQ doesn't exist. Items keep `sort_order` so
 * the PDF matches the in-app table.
 */
export async function getBoqItemsForPdf(
  boqId: string,
  itemIds: readonly string[]
): Promise<{
  boq: { title: string; currency: string; vat_pct: string };
  project: { name: string; client_email: string | null };
  items: Array<BoqItemWithComputed & { section_title: string | null }>;
} | null> {
  if (itemIds.length === 0) return null;
  const pool = getPool();
  const [headerRes, itemsRes] = await Promise.all([
    pool.query<{
      title: string;
      currency: string;
      vat_pct: string;
      project_name: string;
      client_email: string | null;
    }>(
      `SELECT b.title, b.currency, b.vat_pct,
              p.name AS project_name, p.client_email
       FROM boq b
       JOIN project p ON p.id = b.project_id
       WHERE b.id = $1`,
      [boqId]
    ),
    pool.query<BoqItemWithComputed & { section_title: string | null }>(
      `SELECT bi.*, ${ITEM_LIBRARY_COLS}, ${ITEM_COMPUTED_COLS},
              s.title AS section_title
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       ${ITEM_LIBRARY_JOIN}
       LEFT JOIN boq_section s ON s.id = bi.section_id
       WHERE bi.boq_id = $1 AND bi.id = ANY($2::uuid[])
       ORDER BY bi.sort_order, bi.created_at`,
      [boqId, itemIds]
    ),
  ]);
  if (headerRes.rows.length === 0) return null;
  const h = headerRes.rows[0];
  return {
    boq: { title: h.title, currency: h.currency, vat_pct: h.vat_pct },
    project: { name: h.project_name, client_email: h.client_email },
    items: itemsRes.rows,
  };
}

type BoqImportRow = z.infer<typeof boqImportRowSchema>;

/**
 * Atomically append (or replace) BOQ items from a validated import payload.
 * All writes happen inside a single transaction; any failure rolls back.
 *
 * - `strategy = "append"` keeps existing items; inserts new rows after them.
 * - `strategy = "replace"` deletes all existing items first, then inserts.
 *   Does NOT delete sections — a section that no longer has rows stays so
 *   the PM doesn't lose its `budget_cap` / ordering by accident.
 *
 * Missing sections are created on the fly (case-insensitive match on title).
 * Blank item codes auto-assign via the `BOQ` sequence counter. When the
 * provided `itemCode` matches an existing `element.code` in the org, the new
 * row is linked to that element's id.
 */
export async function bulkInsertBoqItems(
  boqId: string,
  orgId: string,
  strategy: BoqImportStrategy,
  rows: BoqImportRow[]
): Promise<BulkBoqImportResult> {
  const pool = getPool();
  const client = await pool.connect();
  const result: BulkBoqImportResult = {
    inserted: 0,
    replaced: 0,
    createdSections: [],
    failed: [],
  };

  try {
    await client.query("BEGIN");

    // Per-BOQ advisory lock — auto-released on COMMIT/ROLLBACK. Serialises
    // concurrent imports against the same BOQ so two PMs hitting "replace"
    // (or even "append") can't race the section-upsert window and produce
    // duplicate rows for the same case-insensitive title.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1::text))`, [
      `boq:${boqId}`,
    ]);

    if (strategy === "replace") {
      const { rowCount } = await client.query(
        `DELETE FROM boq_item WHERE boq_id = $1`,
        [boqId]
      );
      result.replaced = rowCount ?? 0;
    }

    // Pre-fetch existing sections for case-insensitive title matching.
    const { rows: existingSections } = await client.query<{
      id: string;
      title: string;
    }>(`SELECT id, title FROM boq_section WHERE boq_id = $1`, [boqId]);
    const sectionIdByLowerTitle = new Map(
      existingSections.map((s) => [s.title.toLowerCase(), s.id])
    );

    // Assign a section id (create if missing) for every distinct title in the
    // import. Done up-front so we don't create the same section twice.
    const titlesToCreate = new Set<string>();
    for (const r of rows) {
      const title = r.sectionTitle?.trim();
      if (!title) continue;
      if (!sectionIdByLowerTitle.has(title.toLowerCase())) {
        titlesToCreate.add(title);
      }
    }

    if (titlesToCreate.size > 0) {
      // Compute starting sort_order once, then increment locally.
      const { rows: maxRows } = await client.query<{ max: number | null }>(
        `SELECT MAX(sort_order) AS max FROM boq_section WHERE boq_id = $1`,
        [boqId]
      );
      let nextSort = (maxRows[0]?.max ?? -1) + 1;
      for (const title of titlesToCreate) {
        const { rows: created } = await client.query<{ id: string }>(
          `INSERT INTO boq_section (boq_id, title, sort_order)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [boqId, title, nextSort++]
        );
        sectionIdByLowerTitle.set(title.toLowerCase(), created[0].id);
        result.createdSections.push({ id: created[0].id, title });
      }
    }

    // Bulk-advance sequence for any rows missing `itemCode`.
    const blankCount = rows.filter((r) => !r.itemCode?.trim()).length;
    const generatedCodes = await nextSequenceNumbers(
      client,
      orgId,
      "BOQ",
      blankCount
    );
    let genIdx = 0;

    // Prefetch element ids so we don't round-trip per row.
    const codes = Array.from(
      new Set(
        rows.map((r) => r.itemCode?.trim()).filter((c): c is string => !!c)
      )
    );
    let elementIdByCode = new Map<string, string>();
    if (codes.length > 0) {
      const { rows: elemRows } = await client.query<{
        id: string;
        code: string;
      }>(
        `SELECT DISTINCT ON (code) id, code FROM element
          WHERE org_id = $1 AND is_active = true AND code = ANY($2::text[])
          ORDER BY code, version_number DESC`,
        [orgId, codes]
      );
      elementIdByCode = new Map(elemRows.map((r) => [r.code, r.id]));
    }

    // Starting sort_order inside each section.
    const { rows: sortRows } = await client.query<{
      section_id: string | null;
      max: number | null;
    }>(
      `SELECT section_id, MAX(sort_order) AS max
         FROM boq_item WHERE boq_id = $1 GROUP BY section_id`,
      [boqId]
    );
    const nextSortBySection = new Map<string | null, number>();
    for (const row of sortRows) {
      nextSortBySection.set(row.section_id, (row.max ?? -1) + 1);
    }

    for (const row of rows) {
      const title = row.sectionTitle?.trim();
      const sectionId = title
        ? (sectionIdByLowerTitle.get(title.toLowerCase()) ?? null)
        : null;

      const itemCode = row.itemCode?.trim() || generatedCodes[genIdx++];
      const elementId = elementIdByCode.get(itemCode) ?? null;
      const sortOrder = nextSortBySection.get(sectionId) ?? 0;
      nextSortBySection.set(sectionId, sortOrder + 1);

      try {
        await client.query(
          // Same explicit-cast pattern as createBoqItem — without the casts,
          // pg infers numeric placeholders as INTEGER from `COALESCE($N, 0)`
          // and rejects fractional values like "2.50".
          `INSERT INTO boq_item (
             boq_id, section_id, element_id, source, item_code, description, unit,
             quantity, unit_cost, material_cost, labour_cost,
             overhead_pct, service_charge_pct, margin_pct,
             client_rate, budget_rate,
             length, breadth, height, dimension_unit,
             notes, client_notes,
             sort_order, is_provisional
           ) VALUES (
             $1, $2::uuid, $3::uuid,
             CASE WHEN $3::uuid IS NULL THEN 'custom' ELSE 'library' END,
             $4, $5, $6,
             $7::numeric, $8::numeric, $9::numeric, $10::numeric,
             COALESCE($11::numeric, 0), COALESCE($12::numeric, 0), COALESCE($13::numeric, 0),
             $14::numeric, $15::numeric,
             $16::numeric, $17::numeric, $18::numeric, COALESCE($19, 'm'),
             $20, $21,
             $22::int, COALESCE($23, false)
           )`,
          [
            boqId,
            sectionId,
            elementId,
            itemCode,
            row.description,
            row.unit,
            row.quantity,
            row.unitCost,
            row.materialCost ?? null,
            row.labourCost ?? null,
            row.overheadPct ?? null,
            row.serviceChargePct ?? null,
            row.marginPct ?? null,
            row.clientRate ?? null,
            row.budgetRate ?? null,
            row.length ?? null,
            row.breadth ?? null,
            row.height ?? null,
            row.dimensionUnit ?? null,
            row.notes ?? null,
            row.clientNotes ?? null,
            sortOrder,
            row.isProvisional ?? null,
          ]
        );
        result.inserted += 1;
      } catch (err) {
        // Mask raw pg messages — they leak constraint names and SQL snippets.
        // Full text is logged server-side for triage; the user gets a friendly
        // SQLSTATE-mapped string.
        const pgErr = err as { code?: string; message?: string };
        const userMessage = mapPgError(pgErr);
        logger.error("boq import row failed", {
          orgId,
          boqId,
          rowNumber: row.rowNumber,
          itemCode: row.itemCode,
          pgCode: pgErr.code,
          pgMessage: pgErr.message,
          error: userMessage,
        });
        throw new ImportRowError(row.rowNumber, userMessage);
      }
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failures — original error is the one that matters */
    }
    if (err instanceof ImportRowError) {
      return {
        inserted: 0,
        replaced: 0,
        createdSections: [],
        failed: [{ rowNumber: err.rowNumber, error: err.message }],
        rolledBack: true,
      };
    }
    throw err;
  } finally {
    client.release();
  }
}

class ImportRowError extends Error {
  constructor(
    public rowNumber: number,
    message: string
  ) {
    super(message);
    this.name = "ImportRowError";
  }
}

/** Idempotency TTL — 10 minutes, mirrors the element-import value. */
const BOQ_IMPORT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

/**
 * Execute `run` and cache its result under `key` so that a replay of the
 * same (orgId:userId:boqId:strategy:rowsHash) within 10 minutes returns the
 * original result instead of double-committing.
 *
 * Serialisation via session-level `pg_advisory_lock` — two replicas
 * concurrent with the same key queue on each other, and the second call
 * reads the first call's cached result.
 */
export async function withBoqImportIdempotency(
  key: string,
  run: () => Promise<BulkBoqImportResult>
): Promise<{ result: BulkBoqImportResult; replayed: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext($1::text))`, [key]);
    locked = true;

    const { rows: cached } = await client.query<{
      result: BulkBoqImportResult;
    }>(
      `SELECT result FROM boq_import_idempotency
        WHERE key = $1
          AND created_at > now() - ($2::bigint || ' milliseconds')::interval
        LIMIT 1`,
      [key, BOQ_IMPORT_IDEMPOTENCY_TTL_MS]
    );
    if (cached.length > 0) {
      return { result: cached[0].result, replayed: true };
    }

    const result = await run();

    await client.query(
      `INSERT INTO boq_import_idempotency (key, result) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, created_at = now()`,
      [key, JSON.stringify(result)]
    );

    // Opportunistic cleanup — LIMIT keeps the advisory-lock hold bounded.
    await client.query(
      `DELETE FROM boq_import_idempotency
        WHERE key IN (
          SELECT key FROM boq_import_idempotency
           WHERE created_at < now() - ($1::bigint || ' milliseconds')::interval
           LIMIT 100
        )`,
      [BOQ_IMPORT_IDEMPOTENCY_TTL_MS]
    );

    return { result, replayed: false };
  } finally {
    if (locked) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1::text))`, [
          key,
        ]);
      } catch (err) {
        logger.warn("failed to release boq import idempotency advisory lock", {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    client.release();
  }
}
