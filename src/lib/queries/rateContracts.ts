import { getPool } from "@/lib/db";
import type {
  RateContract,
  RateContractListRow,
  RateContractWithDetails,
  AvailableRate,
} from "@/types";
import type {
  RateContractStatus,
  RateContractSortField,
} from "@/lib/validations";
import { escapeSqlLike } from "./helpers";
import { mapPgError } from "./_pgErrors";
import { getNextSequenceNumber } from "./boq";

export interface RateContractFilters {
  search?: string;
  vendorId?: string;
  status?: RateContractStatus;
  sortBy?: RateContractSortField;
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}

/**
 * Whitelist of sortable columns. Validated values map to literal SQL
 * fragments — ORDER BY can't take a parameter.
 */
const RATE_CONTRACT_SORT_SQL: Record<
  NonNullable<RateContractFilters["sortBy"]>,
  string
> = {
  contract_number: "rc.contract_number",
  name: "lower(rc.name)",
  start_date: "rc.start_date",
  end_date: "rc.end_date",
  status: `CASE rc.status
             WHEN 'draft'     THEN 0
             WHEN 'active'    THEN 1
             WHEN 'expired'   THEN 2
             WHEN 'cancelled' THEN 3
           END`,
  updated_at: "rc.updated_at",
};

export interface CreateRateContractInput {
  vendorId: string;
  name: string;
  startDate: string;
  endDate: string;
  agreementSignedDate?: string | null;
  currency?: string;
  paymentTerms?: string | null;
  agreementUrl?: string | null;
  termsAndConditions?: string | null;
  notes?: string | null;
}

export interface UpdateRateContractInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  agreementSignedDate?: string | null;
  currency?: string;
  paymentTerms?: string | null;
  agreementUrl?: string | null;
  termsAndConditions?: string | null;
  notes?: string | null;
  status?: RateContractStatus;
}

const HEADER_UPDATE_COLS: Record<string, string> = {
  name: "name",
  startDate: "start_date",
  endDate: "end_date",
  agreementSignedDate: "agreement_signed_date",
  currency: "currency",
  paymentTerms: "payment_terms",
  agreementUrl: "agreement_url",
  termsAndConditions: "terms_and_conditions",
  notes: "notes",
};

/**
 * Auto-expire active contracts whose end_date is in the past. Same
 * check-on-read pattern used elsewhere (quote/proposal expiry); idempotent
 * and protected by the partial index on status='active'.
 */
async function expireOverdueContracts(orgId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE rate_contract
        SET status = 'expired', updated_at = now()
      WHERE org_id = $1 AND status = 'active' AND end_date < CURRENT_DATE`,
    [orgId]
  );
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Paginated list with vendor join + item count. */
export async function listRateContracts(
  orgId: string,
  filters: RateContractFilters
): Promise<{ rows: RateContractListRow[]; total: number }> {
  await expireOverdueContracts(orgId);

  const pool = getPool();
  const conditions: string[] = ["rc.org_id = $1"];
  const params: unknown[] = [orgId];

  if (filters.search && filters.search.trim()) {
    params.push(`%${escapeSqlLike(filters.search.trim().toLowerCase())}%`);
    const i = params.length;
    conditions.push(
      `(lower(rc.contract_number) LIKE $${i} OR lower(rc.name) LIKE $${i} OR lower(v.company_name) LIKE $${i})`
    );
  }
  if (filters.vendorId) {
    params.push(filters.vendorId);
    conditions.push(`rc.vendor_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`rc.status = $${params.length}`);
  }

  params.push(filters.limit);
  const limitIdx = params.length;
  params.push((filters.page - 1) * filters.limit);
  const offsetIdx = params.length;

  const sortKey = filters.sortBy ?? "updated_at";
  const sortDir = filters.sortOrder === "asc" ? "ASC" : "DESC";
  const orderBy = `${RATE_CONTRACT_SORT_SQL[sortKey]} ${sortDir} NULLS LAST, rc.contract_number DESC`;

  const sql = `
    SELECT
      rc.id, rc.org_id, rc.vendor_id, rc.contract_number, rc.name, rc.status,
      rc.start_date, rc.end_date, rc.agreement_signed_date, rc.currency,
      rc.payment_terms, rc.agreement_url, rc.terms_and_conditions, rc.notes,
      rc.created_by, rc.created_at, rc.updated_at,
      v.company_name AS vendor_name,
      v.kyc_status AS vendor_kyc_status,
      COALESCE(i.cnt, 0)::int AS item_count,
      COUNT(*) OVER() AS total
    FROM rate_contract rc
    JOIN vendor v ON v.id = rc.vendor_id
    LEFT JOIN (
      SELECT rate_contract_id, COUNT(*) AS cnt
        FROM rate_contract_item
       GROUP BY rate_contract_id
    ) i ON i.rate_contract_id = rc.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(sql, params);
  const total = rows[0]?.total ? Number(rows[0].total) : 0;
  const cleaned = rows.map(({ total: _t, ...rest }) => rest);
  return { rows: cleaned as RateContractListRow[], total };
}

/** Detail with full item list joined to elements. */
export async function getRateContractById(
  orgId: string,
  id: string
): Promise<RateContractWithDetails | null> {
  await expireOverdueContracts(orgId);

  const pool = getPool();
  const sql = `
    SELECT
      rc.id, rc.org_id, rc.vendor_id, rc.contract_number, rc.name, rc.status,
      rc.start_date, rc.end_date, rc.agreement_signed_date, rc.currency,
      rc.payment_terms, rc.agreement_url, rc.terms_and_conditions, rc.notes,
      rc.created_by, rc.created_at, rc.updated_at,
      v.company_name AS vendor_name,
      v.kyc_status AS vendor_kyc_status,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', rci.id,
              'rate_contract_id', rci.rate_contract_id,
              'element_id', rci.element_id,
              'unit', rci.unit,
              'rate', rci.rate,
              'notes', rci.notes,
              'element_code', e.code,
              'element_name', e.name,
              'element_unit', e.unit,
              'element_archived', NOT e.is_active
            )
            ORDER BY e.code
          )
          FROM rate_contract_item rci
          JOIN element e ON e.id = rci.element_id
          WHERE rci.rate_contract_id = rc.id
        ),
        '[]'::json
      ) AS items,
      (
        SELECT COUNT(*)::int FROM rate_contract_item WHERE rate_contract_id = rc.id
      ) AS item_count
    FROM rate_contract rc
    JOIN vendor v ON v.id = rc.vendor_id
    WHERE rc.id = $1 AND rc.org_id = $2
  `;
  const { rows } = await pool.query(sql, [id, orgId]);
  return (rows[0] as RateContractWithDetails) ?? null;
}

/**
 * Active rates for one element across all contracts. Sorted by rate ASC so
 * the lowest is first. Excludes archived elements, expired/cancelled/draft
 * contracts. Optional `vendorId` scopes the result.
 */
export async function getActiveRatesForElement(
  orgId: string,
  elementId: string,
  vendorId?: string
): Promise<AvailableRate[]> {
  await expireOverdueContracts(orgId);

  const pool = getPool();
  const conditions: string[] = [
    "rc.org_id = $1",
    "rc.status = 'active'",
    "e.is_active = true",
    "rci.element_id = $2",
  ];
  const params: unknown[] = [orgId, elementId];
  if (vendorId) {
    params.push(vendorId);
    conditions.push(`rc.vendor_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT
       rci.id AS rate_contract_item_id,
       rc.id AS rate_contract_id,
       rc.contract_number,
       rc.name AS contract_name,
       rc.vendor_id,
       v.company_name AS vendor_name,
       e.id AS element_id,
       e.code AS element_code,
       e.name AS element_name,
       rci.unit,
       rci.rate,
       rc.currency,
       rc.end_date
     FROM rate_contract_item rci
     JOIN rate_contract rc ON rc.id = rci.rate_contract_id
     JOIN vendor v ON v.id = rc.vendor_id
     JOIN element e ON e.id = rci.element_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY rci.rate ASC, rc.end_date DESC`,
    params
  );
  return rows.map((r) => ({ ...r, rate: Number(r.rate) })) as AvailableRate[];
}

/** Browse mode: every active contract item across the org. Used by the BOQ picker. */
export async function getAvailableRatesForBoqPicker(
  orgId: string,
  search?: string
): Promise<AvailableRate[]> {
  await expireOverdueContracts(orgId);

  const pool = getPool();
  const conditions: string[] = [
    "rc.org_id = $1",
    "rc.status = 'active'",
    "e.is_active = true",
  ];
  const params: unknown[] = [orgId];
  if (search && search.trim()) {
    params.push(`%${escapeSqlLike(search.trim().toLowerCase())}%`);
    const i = params.length;
    conditions.push(
      `(lower(e.code) LIKE $${i} OR lower(e.name) LIKE $${i} OR lower(v.company_name) LIKE $${i})`
    );
  }
  const { rows } = await pool.query(
    `SELECT
       rci.id AS rate_contract_item_id,
       rc.id AS rate_contract_id,
       rc.contract_number,
       rc.name AS contract_name,
       rc.vendor_id,
       v.company_name AS vendor_name,
       e.id AS element_id,
       e.code AS element_code,
       e.name AS element_name,
       rci.unit,
       rci.rate,
       rc.currency,
       rc.end_date
     FROM rate_contract_item rci
     JOIN rate_contract rc ON rc.id = rci.rate_contract_id
     JOIN vendor v ON v.id = rc.vendor_id
     JOIN element e ON e.id = rci.element_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY lower(e.code), rci.rate ASC
     LIMIT 200`,
    params
  );
  return rows.map((r) => ({ ...r, rate: Number(r.rate) })) as AvailableRate[];
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createRateContract(
  orgId: string,
  userId: string,
  input: CreateRateContractInput
): Promise<RateContract> {
  const pool = getPool();
  const contractNumber = await getNextSequenceNumber(orgId, "RC");

  try {
    const { rows } = await pool.query(
      `INSERT INTO rate_contract (
         org_id, vendor_id, contract_number, name, status,
         start_date, end_date, agreement_signed_date,
         currency, payment_terms, agreement_url,
         terms_and_conditions, notes, created_by
       )
       VALUES ($1, $2, $3, $4, 'draft',
               $5, $6, $7,
               COALESCE($8, 'USD'), $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        orgId,
        input.vendorId,
        contractNumber,
        input.name,
        input.startDate,
        input.endDate,
        input.agreementSignedDate ?? null,
        input.currency ?? null,
        input.paymentTerms ?? null,
        input.agreementUrl ?? null,
        input.termsAndConditions ?? null,
        input.notes ?? null,
        userId,
      ]
    );
    return rows[0] as RateContract;
  } catch (err) {
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  }
}

/**
 * Update header fields. Once the contract is `active`, only `notes`,
 * `terms_and_conditions`, `agreement_url`, `payment_terms`, and explicit
 * status transitions (active → cancelled) are accepted. Returns null when
 * the row is missing or 409 when a disallowed mutation is attempted.
 */
export async function updateRateContract(
  orgId: string,
  id: string,
  patch: UpdateRateContractInput
): Promise<{ ok: true; row: RateContract } | { ok: false; reason: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT * FROM rate_contract WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [id, orgId]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const current = cur.rows[0] as RateContract;

    if (current.status === "active") {
      const ALLOWED_AFTER_ACTIVE = new Set([
        "notes",
        "termsAndConditions",
        "agreementUrl",
        "paymentTerms",
        "status",
      ]);
      const offenders = Object.keys(patch).filter(
        (k) => !ALLOWED_AFTER_ACTIVE.has(k)
      );
      if (offenders.length > 0) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "active_locked" };
      }
      if (
        patch.status &&
        patch.status !== "active" &&
        patch.status !== "cancelled"
      ) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "invalid_status_transition" };
      }
    }

    const setClauses: string[] = [];
    const params: unknown[] = [id, orgId];
    for (const [key, col] of Object.entries(HEADER_UPDATE_COLS)) {
      if (key in patch) {
        params.push((patch as Record<string, unknown>)[key]);
        setClauses.push(`${col} = $${params.length}`);
      }
    }
    if (patch.status) {
      params.push(patch.status);
      setClauses.push(`status = $${params.length}`);
    }

    if (setClauses.length === 0) {
      await client.query("ROLLBACK");
      return { ok: true, row: current };
    }

    setClauses.push(`updated_at = now()`);
    const updated = await client.query(
      `UPDATE rate_contract SET ${setClauses.join(", ")}
        WHERE id = $1 AND org_id = $2
        RETURNING *`,
      params
    );
    await client.query("COMMIT");
    return { ok: true, row: updated.rows[0] as RateContract };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/** Soft delete via status='cancelled'. */
export async function cancelRateContract(
  orgId: string,
  id: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE rate_contract SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND org_id = $2 AND status <> 'cancelled'`,
    [id, orgId]
  );
  return (rowCount ?? 0) > 0;
}

/** Activate: draft → active. Rejects if no items. */
export async function activateRateContract(
  orgId: string,
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      `SELECT status FROM rate_contract WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [id, orgId]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    if (cur.rows[0].status !== "draft") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_status_transition" };
    }
    const items = await client.query(
      `SELECT 1 FROM rate_contract_item WHERE rate_contract_id = $1 LIMIT 1`,
      [id]
    );
    if (items.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "empty" };
    }
    await client.query(
      `UPDATE rate_contract SET status = 'active', updated_at = now()
        WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface AddRateContractItemInput {
  elementId: string;
  unit: string;
  rate: number;
  notes?: string | null;
}

/**
 * Bulk-add or update items. ON CONFLICT (rate_contract_id, element_id)
 * updates rate/unit/notes. Rejects if any element's currency doesn't
 * match the contract's currency.
 */
export async function addRateContractItems(
  orgId: string,
  contractId: string,
  items: AddRateContractItemInput[]
): Promise<{ ok: true; count: number } | { ok: false; reason: string }> {
  if (items.length === 0) return { ok: true, count: 0 };
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const contract = await client.query(
      `SELECT id, currency FROM rate_contract
        WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [contractId, orgId]
    );
    if (contract.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const contractCurrency = contract.rows[0].currency as string;

    const elementIds = items.map((i) => i.elementId);
    const elementRows = await client.query(
      `SELECT id, currency FROM element
        WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, elementIds]
    );
    if (elementRows.rows.length !== elementIds.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "element_not_found" };
    }
    const mismatched = elementRows.rows.find(
      (r) => r.currency !== contractCurrency
    );
    if (mismatched) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "currency_mismatch" };
    }

    let count = 0;
    for (const it of items) {
      const r = await client.query(
        `INSERT INTO rate_contract_item (
           rate_contract_id, element_id, unit, rate, notes
         ) VALUES ($1, $2, $3, $4::numeric, $5)
         ON CONFLICT (rate_contract_id, element_id)
         DO UPDATE SET unit = EXCLUDED.unit,
                       rate = EXCLUDED.rate,
                       notes = EXCLUDED.notes`,
        [contractId, it.elementId, it.unit, it.rate, it.notes ?? null]
      );
      count += r.rowCount ?? 0;
    }

    await client.query(
      `UPDATE rate_contract SET updated_at = now() WHERE id = $1`,
      [contractId]
    );

    await client.query("COMMIT");
    return { ok: true, count };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

export async function removeRateContractItem(
  orgId: string,
  contractId: string,
  itemId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM rate_contract_item rci
       USING rate_contract rc
      WHERE rci.id = $1
        AND rci.rate_contract_id = $2
        AND rc.id = rci.rate_contract_id
        AND rc.org_id = $3`,
    [itemId, contractId, orgId]
  );
  return (rowCount ?? 0) > 0;
}
