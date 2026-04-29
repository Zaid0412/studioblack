import { getPool } from "@/lib/db";
import type {
  Vendor,
  VendorContact,
  VendorWithRelations,
  VendorLite,
  VendorKycDocument,
  EncryptedField,
  BankDetails,
} from "@/types";
import type {
  VendorStatus,
  VendorProficiency,
  VendorKycStatus,
  VendorKycDocumentType,
} from "@/lib/validations";
import { escapeSqlLike } from "./helpers";
import { mapPgError } from "./_pgErrors";

export interface VendorFilters {
  search?: string;
  status?: VendorStatus;
  kycStatus?: VendorKycStatus;
  tradeCategoryId?: string;
  page: number;
  limit: number;
}

export interface CreateVendorInput {
  companyName: string;
  tradingName?: string;
  vendorCode?: string;
  status?: VendorStatus;
  paymentTerms?: string;
  currency?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  taxId?: string;
  address?: Record<string, string | undefined>;
  notes?: string;
  contacts?: Array<{
    name: string;
    title?: string;
    email: string;
    phone?: string;
    isPrimary?: boolean;
    receivesRfq?: boolean;
  }>;
  trades?: Array<{
    categoryId: string;
    proficiencyLevel?: VendorProficiency;
    notes?: string;
  }>;
}

/**
 * Mirror of `updateVendorSchema`'s output: every scalar may be `null` to clear,
 * `undefined` to leave untouched, or a new value.
 */
export interface UpdateVendorInput {
  companyName?: string;
  tradingName?: string | null;
  vendorCode?: string | null;
  status?: VendorStatus;
  paymentTerms?: string | null;
  currency?: string;
  vatRegistered?: boolean;
  vatNumber?: string | null;
  taxId?: string | null;
  address?: Record<string, string | undefined> | null;
  notes?: string | null;
  contacts?: CreateVendorInput["contacts"];
  trades?: CreateVendorInput["trades"];
}

/** Columns that participate in plain partial UPDATE. */
const VENDOR_UPDATE_COLS: Record<string, string> = {
  companyName: "company_name",
  tradingName: "trading_name",
  vendorCode: "vendor_code",
  status: "status",
  paymentTerms: "payment_terms",
  currency: "currency",
  vatRegistered: "vat_registered",
  vatNumber: "vat_number",
  taxId: "tax_id",
  notes: "notes",
};

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * List vendors for an org with filters + pagination. Excludes `bank_details`.
 * Includes contact count + primary contact email aggregated in SQL so the
 * list view doesn't need an N+1.
 */
export async function getVendors(
  orgId: string,
  filters: VendorFilters
): Promise<{
  rows: Array<
    Vendor & {
      contact_count: number;
      primary_contact_email: string | null;
      trade_count: number;
    }
  >;
  total: number;
}> {
  const pool = getPool();
  const conditions: string[] = ["v.org_id = $1"];
  const params: unknown[] = [orgId];

  if (filters.search && filters.search.trim()) {
    params.push(`%${escapeSqlLike(filters.search.trim().toLowerCase())}%`);
    const i = params.length;
    conditions.push(
      `(lower(v.company_name) LIKE $${i} OR lower(COALESCE(v.trading_name, '')) LIKE $${i} OR lower(COALESCE(v.vendor_code, '')) LIKE $${i})`
    );
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`v.status = $${params.length}`);
  }

  if (filters.kycStatus) {
    params.push(filters.kycStatus);
    conditions.push(`v.kyc_status = $${params.length}`);
  }

  if (filters.tradeCategoryId) {
    params.push(filters.tradeCategoryId);
    conditions.push(
      `EXISTS (SELECT 1 FROM vendor_trade vt WHERE vt.vendor_id = v.id AND vt.category_id = $${params.length})`
    );
  }

  params.push(filters.limit);
  const limitIdx = params.length;
  params.push((filters.page - 1) * filters.limit);
  const offsetIdx = params.length;

  const sql = `
    SELECT
      v.id, v.org_id, v.company_name, v.trading_name, v.vendor_code, v.status,
      v.rating, v.payment_terms, v.currency, v.vat_registered, v.vat_number,
      v.tax_id, v.kyc_status, v.kyc_verified_at, v.kyc_verified_by, v.kyc_notes,
      v.address, v.notes, v.created_by, v.created_at, v.updated_at,
      COALESCE(c.cnt, 0)::int AS contact_count,
      c.primary_email AS primary_contact_email,
      COALESCE(t.cnt, 0)::int AS trade_count,
      COUNT(*) OVER() AS total
    FROM vendor v
    LEFT JOIN (
      SELECT vendor_id, COUNT(*) AS cnt,
             MAX(CASE WHEN is_primary THEN email END) AS primary_email
      FROM vendor_contact
      GROUP BY vendor_id
    ) c ON c.vendor_id = v.id
    LEFT JOIN (
      SELECT vendor_id, COUNT(*) AS cnt
      FROM vendor_trade
      GROUP BY vendor_id
    ) t ON t.vendor_id = v.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY lower(v.company_name)
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(sql, params);
  const total = rows[0]?.total ? Number(rows[0].total) : 0;
  // Strip the row-level `total` column before returning.
  const cleaned = rows.map(({ total: _t, ...rest }) => rest);
  return { rows: cleaned as never, total };
}

/** Single vendor with contacts and trades (with category names). No bank details. */
export async function getVendorById(
  orgId: string,
  vendorId: string
): Promise<VendorWithRelations | null> {
  const pool = getPool();
  const sql = `
    SELECT
      v.id, v.org_id, v.company_name, v.trading_name, v.vendor_code, v.status,
      v.rating, v.payment_terms, v.currency, v.vat_registered, v.vat_number,
      v.tax_id, v.kyc_status, v.kyc_verified_at, v.kyc_verified_by, v.kyc_notes,
      v.address, v.notes, v.created_by, v.created_at, v.updated_at,
      COALESCE(
        (
          SELECT json_agg(c ORDER BY c.is_primary DESC, c.created_at)
          FROM vendor_contact c
          WHERE c.vendor_id = v.id
        ), '[]'::json
      ) AS contacts,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', t.id,
            'vendor_id', t.vendor_id,
            'category_id', t.category_id,
            'proficiency_level', t.proficiency_level,
            'notes', t.notes,
            'category_name', ec.name,
            'category_color', ec.color
          ) ORDER BY ec.name)
          FROM vendor_trade t
          JOIN element_category ec ON ec.id = t.category_id
          WHERE t.vendor_id = v.id
        ), '[]'::json
      ) AS trades,
      COALESCE(
        (
          SELECT COUNT(*)
          FROM vendor_kyc_document d
          WHERE d.vendor_id = v.id
            AND d.expires_at IS NOT NULL
            AND d.expires_at <= CURRENT_DATE + INTERVAL '30 days'
        ), 0
      )::int AS kyc_expiring_soon_count
    FROM vendor v
    WHERE v.id = $1 AND v.org_id = $2
  `;
  const { rows } = await pool.query(sql, [vendorId, orgId]);
  return (rows[0] as VendorWithRelations) ?? null;
}

/**
 * Fetch the encrypted envelope for a vendor's bank details. Returns
 * `exists: false` when the vendor row isn't in this org (so the route can
 * 404 without a separate ownership check), and `envelope: null` when the
 * row exists but has no bank details set. Caller decrypts the envelope.
 */
export async function getVendorBankDetailsEnvelope(
  orgId: string,
  vendorId: string
): Promise<{ exists: boolean; envelope: EncryptedField | null }> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT bank_details FROM vendor WHERE id = $1 AND org_id = $2`,
    [vendorId, orgId]
  );
  if (rows.length === 0) return { exists: false, envelope: null };
  return {
    exists: true,
    envelope: (rows[0].bank_details as EncryptedField | null) ?? null,
  };
}

/** Lightweight list for F9 RFQ vendor suggestion. Active vendors only. */
export async function getVendorsByTrade(
  orgId: string,
  categoryId: string
): Promise<VendorLite[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       v.id, v.company_name, v.vendor_code, v.status, v.rating,
       (SELECT email FROM vendor_contact WHERE vendor_id = v.id AND is_primary = true LIMIT 1) AS primary_contact_email
     FROM vendor v
     JOIN vendor_trade t ON t.vendor_id = v.id
     WHERE v.org_id = $1 AND t.category_id = $2 AND v.status = 'active'
     ORDER BY v.rating DESC NULLS LAST, lower(v.company_name)`,
    [orgId, categoryId]
  );
  return rows as VendorLite[];
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a vendor + nested contacts + trades atomically. Throws on a duplicate
 * vendor_code (per-org) or any DB constraint violation.
 */
export async function createVendor(
  orgId: string,
  userId: string,
  input: CreateVendorInput
): Promise<VendorWithRelations> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertVendor = await client.query(
      `INSERT INTO vendor (
         org_id, company_name, trading_name, vendor_code, status,
         payment_terms, currency, vat_registered, vat_number, tax_id,
         address, notes, created_by
       )
       VALUES ($1, $2, $3, $4, COALESCE($5, 'active'),
               $6, COALESCE($7, 'USD'), COALESCE($8, false), $9, $10,
               $11, $12, $13)
       RETURNING id`,
      [
        orgId,
        input.companyName,
        input.tradingName ?? null,
        input.vendorCode ?? null,
        input.status ?? null,
        input.paymentTerms ?? null,
        input.currency ?? null,
        input.vatRegistered ?? null,
        input.vatNumber ?? null,
        input.taxId ?? null,
        input.address ? JSON.stringify(input.address) : null,
        input.notes ?? null,
        userId,
      ]
    );
    const vendorId = insertVendor.rows[0].id as string;

    if (input.contacts?.length) {
      // Enforce one primary at most; if multiple, keep the first marked.
      let primaryClaimed = false;
      for (const c of input.contacts) {
        const isPrimary = c.isPrimary && !primaryClaimed;
        if (isPrimary) primaryClaimed = true;
        await client.query(
          `INSERT INTO vendor_contact (vendor_id, name, title, email, phone, is_primary, receives_rfq)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))`,
          [
            vendorId,
            c.name,
            c.title ?? null,
            c.email,
            c.phone ?? null,
            !!isPrimary,
            c.receivesRfq ?? null,
          ]
        );
      }
    }

    if (input.trades?.length) {
      for (const t of input.trades) {
        await client.query(
          `INSERT INTO vendor_trade (vendor_id, category_id, proficiency_level, notes)
           VALUES ($1, $2, COALESCE($3, 'standard'), $4)
           ON CONFLICT (vendor_id, category_id) DO NOTHING`,
          [vendorId, t.categoryId, t.proficiencyLevel ?? null, t.notes ?? null]
        );
      }
    }

    await client.query("COMMIT");

    const created = await getVendorById(orgId, vendorId);
    if (!created) throw new Error("Vendor created but not found");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/** Partial update of vendor metadata. Contacts/trades are replaced wholesale
 *  if provided. Bank details and rating use dedicated endpoints. */
export async function updateVendor(
  orgId: string,
  vendorId: string,
  patch: UpdateVendorInput
): Promise<VendorWithRelations | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const setClauses: string[] = [];
    const params: unknown[] = [vendorId, orgId];
    for (const [key, col] of Object.entries(VENDOR_UPDATE_COLS)) {
      if (key in patch) {
        params.push((patch as Record<string, unknown>)[key]);
        setClauses.push(`${col} = $${params.length}`);
      }
    }
    if ("address" in patch) {
      params.push(patch.address ? JSON.stringify(patch.address) : null);
      setClauses.push(`address = $${params.length}`);
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = now()`);
      const updated = await client.query(
        `UPDATE vendor SET ${setClauses.join(", ")}
         WHERE id = $1 AND org_id = $2
         RETURNING id`,
        params
      );
      if (updated.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
    } else {
      // Verify ownership when only contacts/trades change.
      const owned = await client.query(
        `SELECT 1 FROM vendor WHERE id = $1 AND org_id = $2`,
        [vendorId, orgId]
      );
      if (owned.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
    }

    if (patch.contacts !== undefined) {
      await client.query(`DELETE FROM vendor_contact WHERE vendor_id = $1`, [
        vendorId,
      ]);
      let primaryClaimed = false;
      for (const c of patch.contacts) {
        const isPrimary = c.isPrimary && !primaryClaimed;
        if (isPrimary) primaryClaimed = true;
        await client.query(
          `INSERT INTO vendor_contact (vendor_id, name, title, email, phone, is_primary, receives_rfq)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))`,
          [
            vendorId,
            c.name,
            c.title ?? null,
            c.email,
            c.phone ?? null,
            !!isPrimary,
            c.receivesRfq ?? null,
          ]
        );
      }
    }

    if (patch.trades !== undefined) {
      await client.query(`DELETE FROM vendor_trade WHERE vendor_id = $1`, [
        vendorId,
      ]);
      for (const t of patch.trades) {
        await client.query(
          `INSERT INTO vendor_trade (vendor_id, category_id, proficiency_level, notes)
           VALUES ($1, $2, COALESCE($3, 'standard'), $4)
           ON CONFLICT (vendor_id, category_id) DO NOTHING`,
          [vendorId, t.categoryId, t.proficiencyLevel ?? null, t.notes ?? null]
        );
      }
    }

    await client.query("COMMIT");
    return await getVendorById(orgId, vendorId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/** Write-only update for the encrypted bank-details envelope. */
export async function updateVendorBankDetails(
  orgId: string,
  vendorId: string,
  envelope: EncryptedField | null
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE vendor
     SET bank_details = $1, updated_at = now()
     WHERE id = $2 AND org_id = $3`,
    [envelope ? JSON.stringify(envelope) : null, vendorId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

/** Update rating only. Architects + PMs can call this. */
export async function updateVendorRating(
  orgId: string,
  vendorId: string,
  rating: number
): Promise<Vendor | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE vendor
     SET rating = $1, updated_at = now()
     WHERE id = $2 AND org_id = $3
     RETURNING id, org_id, company_name, trading_name, vendor_code, status,
               rating, payment_terms, currency, vat_registered, vat_number,
               tax_id, kyc_status, kyc_verified_at, kyc_verified_by, kyc_notes,
               address, notes, created_by, created_at, updated_at`,
    [rating, vendorId, orgId]
  );
  return (rows[0] as Vendor) ?? null;
}

/** Soft delete: status → 'inactive'. Preserves history and FK references. */
export async function softDeleteVendor(
  orgId: string,
  vendorId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE vendor SET status = 'inactive', updated_at = now()
     WHERE id = $1 AND org_id = $2`,
    [vendorId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Hard delete. CASCADE removes contacts and trades.
 * Once F9 (RFQ) lands this should refuse when any RFQ references the vendor;
 * for now there are no such references, so it's unconstrained.
 */
export async function hardDeleteVendor(
  orgId: string,
  vendorId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM vendor WHERE id = $1 AND org_id = $2`,
    [vendorId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── KYC (F7.1) ─────────────────────────────────────────────────────────────

/** Inserted alongside a vendor KYC document. Date strings are ISO (YYYY-MM-DD). */
export interface AddKycDocumentInput {
  docType: VendorKycDocumentType;
  fileUrl: string;
  fileName: string;
  expiresAt?: string | null;
  notes?: string | null;
}

/**
 * Insert a KYC document for a vendor. If the vendor's current `kyc_status`
 * is `'unverified'` it auto-flips to `'pending'` in the same transaction so
 * PMs see something to review. Already-verified or already-rejected vendors
 * are left alone — those need an explicit status change.
 */
export async function addKycDocument(
  orgId: string,
  vendorId: string,
  uploadedBy: string,
  input: AddKycDocumentInput
): Promise<{
  document: VendorKycDocument;
  vendorKycStatus: VendorKycStatus;
} | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // INSERT...SELECT enforces org isolation in the same statement: the row
    // is only inserted when the vendor exists under this org. RETURNING also
    // surfaces the vendor's prior kyc_status so we can decide whether to flip.
    const insert = await client.query(
      `WITH v AS (
         SELECT id, kyc_status FROM vendor WHERE id = $1 AND org_id = $2
       )
       INSERT INTO vendor_kyc_document
         (vendor_id, doc_type, file_url, file_name, expires_at, uploaded_by, notes)
       SELECT v.id, $3, $4, $5, $6, $7, $8 FROM v
       RETURNING id, vendor_id, doc_type, file_url, file_name,
                 expires_at, uploaded_by, uploaded_at, notes,
                 (SELECT kyc_status FROM v) AS prior_kyc_status`,
      [
        vendorId,
        orgId,
        input.docType,
        input.fileUrl,
        input.fileName,
        input.expiresAt ?? null,
        uploadedBy,
        input.notes ?? null,
      ]
    );

    if (insert.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const { prior_kyc_status: priorStatus, ...document } = insert.rows[0] as {
      prior_kyc_status: VendorKycStatus;
    } & VendorKycDocument;

    let vendorKycStatus = priorStatus;
    if (priorStatus === "unverified") {
      vendorKycStatus = "pending";
      await client.query(
        `UPDATE vendor SET kyc_status = 'pending', updated_at = now()
         WHERE id = $1 AND org_id = $2`,
        [vendorId, orgId]
      );
    }

    await client.query("COMMIT");
    return {
      document: document as VendorKycDocument,
      vendorKycStatus,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

export async function listKycDocuments(
  orgId: string,
  vendorId: string
): Promise<VendorKycDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT d.id, d.vendor_id, d.doc_type, d.file_url, d.file_name,
            d.expires_at, d.uploaded_by, d.uploaded_at, d.notes
     FROM vendor_kyc_document d
     JOIN vendor v ON v.id = d.vendor_id
     WHERE v.org_id = $1 AND d.vendor_id = $2
     ORDER BY d.uploaded_at DESC`,
    [orgId, vendorId]
  );
  return rows as VendorKycDocument[];
}

/** Hard-delete the document row. The underlying file in storage is left as-is
 *  (mirrors element/attachment soft-path). */
export async function removeKycDocument(
  orgId: string,
  vendorId: string,
  docId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM vendor_kyc_document
     WHERE id = $1 AND vendor_id = $2
       AND vendor_id IN (SELECT id FROM vendor WHERE org_id = $3)`,
    [docId, vendorId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

/** PM-only: flip kyc_status. Stamps verifier + timestamp. */
export async function setKycStatus(
  orgId: string,
  vendorId: string,
  status: VendorKycStatus,
  notes: string | null,
  verifiedBy: string
): Promise<VendorWithRelations | null> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE vendor
     SET kyc_status = $1,
         kyc_verified_at = now(),
         kyc_verified_by = $2,
         kyc_notes = $3,
         updated_at = now()
     WHERE id = $4 AND org_id = $5`,
    [status, verifiedBy, notes, vendorId, orgId]
  );
  if ((rowCount ?? 0) === 0) return null;
  return await getVendorById(orgId, vendorId);
}

// Re-export the type so callers that import from "@/lib/queries" can get it
// without pulling from "@/types" too. Mirrors the elements module.
export type { BankDetails };
