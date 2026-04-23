import { getPool } from "@/lib/db";
import type {
  Boq,
  BoqSection,
  BoqItemWithComputed,
  BoqSummary,
  BoqWithDetails,
} from "@/types";
import type {
  BoqItemLifecycleStatus,
  BoqItemClientApprovalStatus,
} from "@/lib/validations";

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
