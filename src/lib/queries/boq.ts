import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import type {
  Boq,
  BoqElementLite,
  BoqSection,
  BoqItemWithComputed,
  BoqSummary,
  BoqWithDetails,
  BulkBoqImportResult,
} from "@/types";
import type {
  BoqImportStrategy,
  BoqItemLifecycleStatus,
  BoqItemClientApprovalStatus,
  BoqStatus,
} from "@/lib/validations";
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
  bi.quantity * bi.unit_cost * (1 + COALESCE(bi.overhead_pct, 0)/100) AS subtotal,
  bi.quantity * bi.unit_cost * (1 + COALESCE(bi.overhead_pct, 0)/100) * (1 + bi.margin_pct/100) AS sell_price,
  CASE
    WHEN bi.installed_qty > 0
    THEN ROUND(bi.installed_qty / NULLIF(bi.quantity, 0) * 100, 1)
    ELSE 0
  END AS progress_pct,
  (bi.margin_pct < b.minimum_margin_pct) AS margin_alert
`;

const ITEM_SELECT = `SELECT bi.*, ${ITEM_COMPUTED_COLS} FROM boq_item bi JOIN boq b ON b.id = bi.boq_id`;

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
 * Fetch a BOQ's status, scoped to a project. Returns null if the BOQ does not
 * belong to the project. Used by route handlers to gate mutating operations
 * on locked / superseded BOQs.
 */
export async function getBoqStatus(
  boqId: string,
  projectId: string
): Promise<BoqStatus | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ status: BoqStatus }>(
    `SELECT status FROM boq WHERE id = $1 AND project_id = $2`,
    [boqId, projectId]
  );
  return rows[0]?.status ?? null;
}

/** Look up the BOQ status for the BOQ that owns a given section. */
export async function getBoqStatusForSection(
  sectionId: string,
  projectId: string
): Promise<BoqStatus | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ status: BoqStatus }>(
    `SELECT b.status FROM boq_section s
     JOIN boq b ON b.id = s.boq_id
     WHERE s.id = $1 AND b.project_id = $2`,
    [sectionId, projectId]
  );
  return rows[0]?.status ?? null;
}

/** Look up the BOQ status for the BOQ that owns a given item. */
export async function getBoqStatusForItem(
  itemId: string,
  projectId: string
): Promise<BoqStatus | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ status: BoqStatus }>(
    `SELECT b.status FROM boq_item bi
     JOIN boq b ON b.id = bi.boq_id
     WHERE bi.id = $1 AND b.project_id = $2`,
    [itemId, projectId]
  );
  return rows[0]?.status ?? null;
}

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

export async function getBoqByProject(projectId: string): Promise<Boq | null> {
  const pool = getPool();
  const { rows } = await pool.query<Boq>(
    `SELECT * FROM boq
     WHERE project_id = $1 AND status != 'superseded'
     ORDER BY version DESC
     LIMIT 1`,
    [projectId]
  );
  return rows[0] ?? null;
}

export async function getBoq(boqId: string): Promise<BoqWithDetails | null> {
  const pool = getPool();

  const [boqRes, sectionsRes, itemsRes, summary] = await Promise.all([
    pool.query<Boq>(`SELECT * FROM boq WHERE id = $1`, [boqId]),
    pool.query<BoqSection>(
      `SELECT * FROM boq_section WHERE boq_id = $1 ORDER BY sort_order, created_at`,
      [boqId]
    ),
    pool.query<BoqItemWithComputed>(
      `${ITEM_SELECT} WHERE bi.boq_id = $1 ORDER BY bi.sort_order, bi.created_at`,
      [boqId]
    ),
    getBoqSummary(boqId),
  ]);

  if (boqRes.rows.length === 0) return null;

  return {
    ...boqRes.rows[0],
    sections: sectionsRes.rows,
    items: itemsRes.rows,
    summary,
  };
}

export type UpdateBoqInput = Partial<Omit<CreateBoqInput, "createdBy">> & {
  status?: BoqStatus;
};

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
  status: "status",
};

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

export interface CreateBoqSectionInput {
  title: string;
  description?: string | null;
  sortOrder?: number;
  budgetCap?: number | null;
  isVisibleToClient?: boolean;
}

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

/** Delete a section. Items assigned to it have section_id → NULL via FK. */
export async function deleteBoqSection(sectionId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM boq_section WHERE id = $1`,
    [sectionId]
  );
  return (rowCount ?? 0) > 0;
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
  itemCode?: string;
  description: string;
  unit: string;
  quantity?: number;
  unitCost?: number;
  materialCost?: number | null;
  labourCost?: number | null;
  overheadPct?: number;
  marginPct?: number;
  notes?: string | null;
  clientNotes?: string | null;
  sortOrder?: number;
  isProvisional?: boolean;
  isExcluded?: boolean;
}

export async function createBoqItem(
  boqId: string,
  orgId: string,
  input: CreateBoqItemInput
): Promise<BoqItemWithComputed> {
  const itemCode = input.itemCode?.trim()
    ? input.itemCode.trim()
    : await getNextSequenceNumber(orgId, "BOQ");

  const pool = getPool();
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH inserted AS (
       INSERT INTO boq_item (
         boq_id, section_id, element_id, item_code, description, unit,
         quantity, unit_cost, material_cost, labour_cost,
         overhead_pct, margin_pct, notes, client_notes,
         sort_order, is_provisional, is_excluded
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6,
         COALESCE($7, 0), COALESCE($8, 0), $9, $10,
         COALESCE($11, 0), COALESCE($12, 0), $13, $14,
         COALESCE($15, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM boq_item WHERE boq_id = $1 AND section_id IS NOT DISTINCT FROM $2::uuid)),
         COALESCE($16, false), COALESCE($17, false)
       )
       RETURNING *
     )
     SELECT bi.*, ${ITEM_COMPUTED_COLS}
     FROM inserted bi
     JOIN boq b ON b.id = bi.boq_id`,
    [
      boqId,
      input.sectionId ?? null,
      input.elementId ?? null,
      itemCode,
      input.description,
      input.unit,
      input.quantity ?? null,
      input.unitCost ?? null,
      input.materialCost ?? null,
      input.labourCost ?? null,
      input.overheadPct ?? null,
      input.marginPct ?? null,
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
  description?: string;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  materialCost?: number | null;
  labourCost?: number | null;
  overheadPct?: number;
  marginPct?: number;
  lifecycleStatus?: BoqItemLifecycleStatus;
  clientApprovalStatus?: BoqItemClientApprovalStatus;
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
  description: "description",
  unit: "unit",
  quantity: "quantity",
  unitCost: "unit_cost",
  materialCost: "material_cost",
  labourCost: "labour_cost",
  overheadPct: "overhead_pct",
  marginPct: "margin_pct",
  lifecycleStatus: "lifecycle_status",
  clientApprovalStatus: "client_approval_status",
  installedQty: "installed_qty",
  notes: "notes",
  clientNotes: "client_notes",
  sortOrder: "sort_order",
  isProvisional: "is_provisional",
  isExcluded: "is_excluded",
};

/**
 * Fields that represent a material change to an approved item — editing any of
 * these flips `requires_reapproval = true` and `client_approval_status = 'pending'`
 * so the client must re-review.
 */
const REAPPROVAL_FIELDS = new Set<keyof UpdateBoqItemInput>([
  "description",
  "unit",
  "quantity",
  "unitCost",
  "materialCost",
  "labourCost",
  "overheadPct",
  "marginPct",
  "sectionId",
]);

export type UpdateBoqItemOutcome =
  | { ok: true; item: BoqItemWithComputed }
  | { ok: false; reason: "not_found" | "conflict" };

/**
 * Update a BOQ item with optimistic locking via `updated_at`.
 *
 * If `client_approval_status` was `approved` and the caller edits any cost /
 * description / section field, automatically sets `requires_reapproval = true`
 * and flips `client_approval_status` to `pending`.
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

  // Auto-flip re-approval only when the caller didn't explicitly set approval status;
  // otherwise the caller's value would be overwritten.
  const callerSetApproval = input.clientApprovalStatus !== undefined;
  if (changedMaterialField && !callerSetApproval) {
    setClauses.push(
      `requires_reapproval = CASE WHEN client_approval_status = 'approved' THEN true ELSE requires_reapproval END`
    );
    setClauses.push(
      `client_approval_status = CASE WHEN client_approval_status = 'approved' THEN 'pending' ELSE client_approval_status END`
    );
  }

  setClauses.push(`updated_at = now()`);

  const pool = getPool();
  const { rows } = await pool.query<BoqItemWithComputed>(
    `WITH updated AS (
       UPDATE boq_item bi
       SET ${setClauses.join(", ")}
       WHERE bi.id = $${i} AND bi.updated_at = $${i + 1}
       RETURNING *
     )
     SELECT bi.*, ${ITEM_COMPUTED_COLS}
     FROM updated bi
     JOIN boq b ON b.id = bi.boq_id`,
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

/** Delete a BOQ item with optimistic locking via `updated_at`. */
export async function deleteBoqItem(
  itemId: string,
  expectedUpdatedAt: string
): Promise<DeleteBoqItemOutcome> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM boq_item WHERE id = $1 AND updated_at = $2`,
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

export async function addElementToBoq(
  boqId: string,
  orgId: string,
  params: {
    sectionId: string | null;
    elementId: string;
    quantity?: number;
  }
): Promise<BoqItemWithComputed | null> {
  const pool = getPool();
  const { rows: elementRows } = await pool.query(
    `SELECT code, name, description, unit, unit_cost, material_cost, labour_cost,
            overhead_pct, margin_pct
     FROM element WHERE id = $1`,
    [params.elementId]
  );
  if (elementRows.length === 0) return null;
  const e = elementRows[0];

  return createBoqItem(boqId, orgId, {
    sectionId: params.sectionId,
    elementId: params.elementId,
    itemCode: e.code,
    description: e.description || e.name,
    unit: e.unit,
    quantity: params.quantity ?? 1,
    unitCost: Number(e.unit_cost),
    materialCost: e.material_cost !== null ? Number(e.material_cost) : null,
    labourCost: e.labour_cost !== null ? Number(e.labour_cost) : null,
    overheadPct: e.overhead_pct !== null ? Number(e.overhead_pct) : 0,
    marginPct: e.margin_pct !== null ? Number(e.margin_pct) : 0,
  });
}

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
           * (1 + bi.margin_pct/100)
         ) FILTER (WHERE NOT bi.is_excluded), 0) AS total_sell_price,
         COALESCE(AVG(bi.margin_pct) FILTER (WHERE NOT bi.is_excluded), 0) AS average_margin_pct,
         COUNT(*) FILTER (WHERE bi.margin_pct < b.minimum_margin_pct AND NOT bi.is_excluded) AS margin_bleed_count,
         COUNT(*) FILTER (WHERE bi.client_approval_status = 'pending') AS pending_approvals,
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

/** Bulk-advance the sequence counter and return N formatted codes in order. */
async function nextSequenceNumbers(
  orgId: string,
  prefix: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const year = new Date().getUTCFullYear();
  const pool = getPool();
  const { rows } = await pool.query<{ current_value: number }>(
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

/** Lightweight read used by the export writer — same shape as `getBoq`. */
export async function getBoqForExport(
  boqId: string
): Promise<BoqWithDetails | null> {
  return getBoq(boqId);
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
    const generatedCodes = await nextSequenceNumbers(orgId, "BOQ", blankCount);
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
          `INSERT INTO boq_item (
             boq_id, section_id, element_id, item_code, description, unit,
             quantity, unit_cost, material_cost, labour_cost,
             overhead_pct, margin_pct, notes, client_notes,
             sort_order, is_provisional
           ) VALUES (
             $1, $2::uuid, $3::uuid, $4, $5, $6,
             $7, $8, $9, $10,
             COALESCE($11, 0), COALESCE($12, 0), $13, $14,
             $15, COALESCE($16, false)
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
            row.marginPct ?? null,
            row.notes ?? null,
            row.clientNotes ?? null,
            sortOrder,
            row.isProvisional ?? null,
          ]
        );
        result.inserted += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ImportRowError(row.rowNumber, message);
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
