import { getPool } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { requireServiceAreas } from "./sequences";
import type {
  Vendor,
  VendorWithRelations,
  VendorSelfView,
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
import { escapeSqlLike, descendantCategoryIdsSql } from "./helpers";
import { mapPgError } from "./_pgErrors";
import { updateUserEmail } from "./emailChange";

/**
 * Canonical form for a contact email — trimmed + lowercased. Stored this way so
 * duplicate detection, RFQ-recipient de-duplication, and the
 * `linkVendorContactByEmail` match (which lowercases both sides) all agree, and
 * so `A@x.com` / `a@x.com ` can't become two distinct contacts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface VendorFilters {
  search?: string;
  status?: VendorStatus;
  kycStatus?: VendorKycStatus;
  tradeCategoryId?: string;
  preferred?: boolean;
  sortBy?:
    | "vendor_code"
    | "company_name"
    | "rating"
    | "kyc_status"
    | "updated_at";
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}

/**
 * Whitelist of sortable columns. Validated values map to literal SQL
 * fragments — ORDER BY can't take a parameter. `kyc_status` uses a CASE
 * expression so the workflow order (unverified → pending → verified →
 * rejected) is more useful than alphabetical.
 */
const VENDOR_SORT_SQL: Record<NonNullable<VendorFilters["sortBy"]>, string> = {
  vendor_code: "v.vendor_code",
  company_name: "lower(v.company_name)",
  rating: "v.rating",
  kyc_status: `CASE v.kyc_status
                 WHEN 'unverified' THEN 0
                 WHEN 'pending'    THEN 1
                 WHEN 'verified'   THEN 2
                 WHEN 'rejected'   THEN 3
               END`,
  updated_at: "v.updated_at",
};

export interface CreateVendorInput {
  companyName: string;
  tradingName?: string;
  vendorCode?: string;
  status?: VendorStatus;
  paymentTerms?: string;
  currency?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  gstin?: string;
  website?: string;
  preferredVendor?: boolean;
  brandsSupported?: string[];
  /** Multiple addresses per vendor (HQ, warehouse, billing, …). */
  addresses?: Array<Record<string, string | boolean | undefined>>;
  notes?: string;
  contacts?: Array<{
    /** Present for an existing contact being edited; absent for a new one. */
    id?: string;
    name: string;
    title?: string;
    email: string;
    phone?: string;
    isPrimary?: boolean;
    isSecondary?: boolean;
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
  gstin?: string | null;
  website?: string | null;
  preferredVendor?: boolean;
  brandsSupported?: string[];
  /** Replaces the addresses array wholesale when provided. */
  addresses?: Array<Record<string, string | boolean | undefined>>;
  notes?: string | null;
  contacts?: CreateVendorInput["contacts"];
  trades?: CreateVendorInput["trades"];
}

/**
 * Coerce the inbound `addresses` array into the JSON-string array shape pg
 * expects for a `jsonb[]` parameter. `undefined` and `[]` both map to
 * `null` so the caller can use `COALESCE(..., '{}'::jsonb[])` to default
 * to an empty array.
 */
function addressesArray(
  addresses: Array<Record<string, unknown>> | undefined
): string[] | null {
  if (!addresses?.length) return null;
  return addresses.map((a) => JSON.stringify(a));
}

/**
 * Columns that participate in plain partial UPDATE.
 *
 * `tax_id` is intentionally NOT listed — the column still exists on the
 * `vendor` table for legacy data, but the UI no longer collects it and
 * mutations can't set it. Drop the column in a follow-up once existing
 * data is confirmed unneeded.
 */
const VENDOR_UPDATE_COLS: Record<string, string> = {
  companyName: "company_name",
  tradingName: "trading_name",
  vendorCode: "vendor_code",
  status: "status",
  paymentTerms: "payment_terms",
  currency: "currency",
  vatRegistered: "vat_registered",
  vatNumber: "vat_number",
  gstin: "gstin",
  website: "website",
  preferredVendor: "preferred_vendor",
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
  /**
   * Bulky text-array columns (`gstin`, `website`, `brands_supported`) are
   * intentionally absent — fetch a single vendor via `getVendorById` when
   * those are needed.
   */
  rows: Array<
    Omit<Vendor, "gstin" | "website" | "brands_supported"> & {
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
    // Match the category AND every descendant (shared CTE with the element
    // library filter) so selecting a parent node surfaces vendors mapped to
    // any sub-category.
    conditions.push(
      `EXISTS (
         SELECT 1 FROM vendor_trade vt
         WHERE vt.vendor_id = v.id
           AND vt.category_id IN ${descendantCategoryIdsSql(params.length)}
       )`
    );
  }

  if (filters.preferred) {
    conditions.push(`v.preferred_vendor = true`);
  }

  params.push(filters.limit);
  const limitIdx = params.length;
  params.push((filters.page - 1) * filters.limit);
  const offsetIdx = params.length;

  const sortKey = filters.sortBy ?? "company_name";
  const sortDir = filters.sortOrder === "desc" ? "DESC" : "ASC";
  const orderBy = `${VENDOR_SORT_SQL[sortKey]} ${sortDir} NULLS LAST, lower(v.company_name) ASC`;

  const sql = `
    SELECT
      v.id, v.org_id, v.company_name, v.trading_name, v.vendor_code, v.status,
      v.rating, v.payment_terms, v.currency, v.vat_registered, v.vat_number,
      v.tax_id, v.kyc_status, v.kyc_verified_at, v.kyc_verified_by, v.kyc_notes,
      v.address, v.addresses,
      -- gstin / website / brands_supported omitted: list view doesn't render
      -- them and brands_supported can TOAST to several KB per row.
      v.preferred_vendor,
      v.notes, v.created_by, v.created_at, v.updated_at,
      COALESCE(c.cnt, 0)::int AS contact_count,
      c.primary_email AS primary_contact_email,
      COALESCE(t.cnt, 0)::int AS trade_count,
      COUNT(*) OVER() AS total
    FROM vendor v
    -- LATERAL per-row indexed counts (idx_vendor_contact_vendor /
    -- idx_vendor_trade_vendor) instead of a GROUP BY over every tenant's
    -- contacts/trades. The COUNT(*) OVER() total still forces evaluating all
    -- rows matching WHERE (pre-LIMIT), so a count runs per filtered vendor —
    -- bounded by this org's result set, not the whole child table.
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt,
             MAX(CASE WHEN is_primary THEN email END) AS primary_email
      FROM vendor_contact vc
      WHERE vc.vendor_id = v.id
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM vendor_trade vt
      WHERE vt.vendor_id = v.id
    ) t ON true
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(sql, params);
  const total = rows[0]?.total ? Number(rows[0].total) : 0;
  // Strip the row-level `total` column before returning.
  const cleaned = rows.map((r) => {
    const copy = { ...r };
    delete (copy as { total?: unknown }).total;
    return copy;
  });
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
      v.address, v.addresses,
      v.gstin, v.website, v.preferred_vendor,
      v.brands_supported,
      v.notes, v.created_by, v.created_at, v.updated_at,
      COALESCE(
        (
          SELECT json_agg(c ORDER BY c.is_primary DESC, c.is_secondary DESC, c.created_at)
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
 * Translate a vendor write failure. A duplicate `vendor_code` (the
 * `vendor_org_code_uk` index) gets a clean, field-identifiable message so the
 * form can flag the code input; everything else falls back to the generic
 * pg translator.
 */
function vendorWriteError(err: unknown): Error & { field?: string } {
  const e = err as { code?: string; constraint?: string };
  if (e.code === "23505" && e.constraint === "vendor_org_code_uk") {
    // Tag the offending field so the route can return it (and a 409) without
    // re-sniffing the message string.
    return Object.assign(new Error("A vendor with this code already exists"), {
      field: "vendorCode",
    });
  }
  return new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
}

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
         payment_terms, currency, vat_registered, vat_number,
         gstin, website, preferred_vendor,
         brands_supported,
         addresses, notes, created_by
       )
       VALUES ($1, $2, $3, $4, COALESCE($5, 'active'),
               $6, $7, COALESCE($8, false), $9,
               $10, $11, COALESCE($12, false),
               COALESCE($13::text[], '{}'::text[]),
               COALESCE($14::jsonb[], '{}'::jsonb[]), $15, $16)
       RETURNING id`,
      [
        orgId,
        input.companyName,
        input.tradingName ?? null,
        input.vendorCode ?? null,
        input.status ?? null,
        input.paymentTerms ?? null,
        input.currency ?? DEFAULT_CURRENCY,
        input.vatRegistered ?? null,
        input.vatNumber ?? null,
        input.gstin ?? null,
        input.website ?? null,
        input.preferredVendor ?? null,
        input.brandsSupported ?? null,
        addressesArray(input.addresses),
        input.notes ?? null,
        userId,
      ]
    );
    const vendorId = insertVendor.rows[0].id as string;

    if (input.contacts?.length) {
      // Enforce one primary + one secondary at most. DB unique partial
      // indexes back this up — the loop just keeps the first match wins
      // semantics so we don't surface a 23505 to the caller.
      let primaryClaimed = false;
      let secondaryClaimed = false;
      for (const c of input.contacts) {
        const isPrimary = !!c.isPrimary && !primaryClaimed;
        if (isPrimary) primaryClaimed = true;
        const isSecondary = !!c.isSecondary && !isPrimary && !secondaryClaimed;
        if (isSecondary) secondaryClaimed = true;
        await client.query(
          `INSERT INTO vendor_contact (vendor_id, name, title, email, phone, is_primary, is_secondary, receives_rfq)
           VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true))`,
          [
            vendorId,
            c.name,
            c.title ?? null,
            normalizeEmail(c.email),
            c.phone ?? null,
            isPrimary,
            isSecondary,
            c.receivesRfq ?? null,
          ]
        );
      }
    }

    if (input.trades?.length) {
      // A vendor may declare zero trades — but a trade that IS declared names a
      // Service Area, not a whole Sub-category. Validated as a batch: one query
      // for the list, not one per row.
      await requireServiceAreas(
        client,
        orgId,
        input.trades.map((t) => t.categoryId)
      );
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
    throw vendorWriteError(err);
  } finally {
    client.release();
  }
}

/**
 * Partial update of vendor metadata. Contacts/trades are replaced wholesale
 * if provided. Bank details and rating use dedicated endpoints.
 */
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
    if ("addresses" in patch) {
      params.push(addressesArray(patch.addresses));
      setClauses.push(
        `addresses = COALESCE($${params.length}::jsonb[], '{}'::jsonb[])`
      );
    }
    if ("brandsSupported" in patch) {
      params.push(patch.brandsSupported ?? null);
      setClauses.push(
        `brands_supported = COALESCE($${params.length}::text[], '{}'::text[])`
      );
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
      // Reconcile contacts in place, keyed on the round-tripped id, so an
      // existing contact keeps its portal link (`user_id`) across an edit — and
      // when a *linked* contact's email changes, the change flows through to the
      // login identity so magic-link / invite mail follows the new address.
      const { rows: existing } = await client.query<{
        id: string;
        email: string;
        user_id: string | null;
      }>(`SELECT id, email, user_id FROM vendor_contact WHERE vendor_id = $1`, [
        vendorId,
      ]);
      const existingById = new Map(existing.map((r) => [r.id, r]));

      // Clear the flags up front so re-assigning the single Main/Secondary below
      // can't transiently trip the "one primary per vendor" partial unique index.
      await client.query(
        `UPDATE vendor_contact SET is_primary = false, is_secondary = false WHERE vendor_id = $1`,
        [vendorId]
      );

      let primaryClaimed = false;
      let secondaryClaimed = false;
      const keptIds: string[] = [];
      for (const c of patch.contacts) {
        const isPrimary = !!c.isPrimary && !primaryClaimed;
        if (isPrimary) primaryClaimed = true;
        const isSecondary = !!c.isSecondary && !isPrimary && !secondaryClaimed;
        if (isSecondary) secondaryClaimed = true;
        const email = normalizeEmail(c.email);
        // Trust `id` only when it's this vendor's row; anything else is new.
        const prior = c.id ? existingById.get(c.id) : undefined;

        if (prior) {
          await client.query(
            `UPDATE vendor_contact
                SET name = $1, title = $2, email = $3, phone = $4,
                    is_primary = $5, is_secondary = $6,
                    receives_rfq = COALESCE($7, true)
              WHERE id = $8 AND vendor_id = $9`,
            [
              c.name,
              c.title ?? null,
              email,
              c.phone ?? null,
              isPrimary,
              isSecondary,
              c.receivesRfq ?? null,
              prior.id,
              vendorId,
            ]
          );
          keptIds.push(prior.id);
          if (prior.user_id && normalizeEmail(prior.email) !== email) {
            await updateUserEmail(prior.user_id, email, client);
          }
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO vendor_contact (vendor_id, name, title, email, phone, is_primary, is_secondary, receives_rfq)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true))
             RETURNING id`,
            [
              vendorId,
              c.name,
              c.title ?? null,
              email,
              c.phone ?? null,
              isPrimary,
              isSecondary,
              c.receivesRfq ?? null,
            ]
          );
          keptIds.push(rows[0].id);
        }
      }

      // Drop the contacts removed from the form (empty kept set → delete all).
      await client.query(
        `DELETE FROM vendor_contact WHERE vendor_id = $1 AND id <> ALL($2::uuid[])`,
        [vendorId, keptIds]
      );
    }

    if (patch.trades !== undefined) {
      await requireServiceAreas(
        client,
        orgId,
        patch.trades.map((t) => t.categoryId)
      );
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
    throw vendorWriteError(err);
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
               address, addresses,
               gstin, website, preferred_vendor,
               brands_supported,
               notes, created_by, created_at, updated_at`,
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

/** All KYC documents for one vendor, newest first. Org-scoped via the JOIN. */
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

/**
 * Hard-delete the document row. The underlying file in storage is left as-is
 * (mirrors element/attachment soft-path).
 */
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

// ─── Vendor Portal — Self-Service (F8.5) ────────────────────────────────────
//
// Vendor users edit their own vendor record from /profile.
// These helpers skip the org-id check that PM-side queries use because
// authorization is established up-front via vendor_contact.user_id; the
// `withAuth({ fetchVendorId: true })` option resolves the caller's vendor_id
// from session, so callers here never see a vendor_id they don't own.

/**
 * Resolve the vendor_id linked to a user via `vendor_contact.user_id`. A user
 * can in theory be a contact on multiple vendors (rare); we pick the most
 * recent link to match the invite-resolution behaviour elsewhere.
 */
export async function getVendorIdByUserId(
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT vendor_id FROM vendor_contact
       WHERE user_id = $1
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 1`,
    [userId]
  );
  return (rows[0]?.vendor_id as string) ?? null;
}

/**
 * Vendor + contacts + trades, fetched by vendor_id without org guard.
 * Returns a `VendorSelfView` — `preferred_vendor` is intentionally absent
 * since it's a PM-only flag.
 */
export async function getVendorSelfById(
  vendorId: string
): Promise<VendorSelfView | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       v.id, v.org_id, v.company_name, v.trading_name, v.vendor_code, v.status,
       v.rating, v.payment_terms, v.currency, v.vat_registered, v.vat_number,
       v.tax_id, v.kyc_status, v.kyc_verified_at, v.kyc_verified_by, v.kyc_notes,
       v.address, v.addresses,
       v.gstin, v.website,
       v.brands_supported,
       v.created_by, v.created_at, v.updated_at,
       COALESCE(
         (
           SELECT json_agg(c ORDER BY c.is_primary DESC, c.is_secondary DESC, c.created_at)
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
     WHERE v.id = $1`,
    [vendorId]
  );
  return (rows[0] as VendorSelfView) ?? null;
}

/** Bank-details envelope for a vendor by id (no org guard). */
export async function getVendorBankDetailsEnvelopeById(
  vendorId: string
): Promise<{ exists: boolean; envelope: EncryptedField | null }> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT bank_details FROM vendor WHERE id = $1`,
    [vendorId]
  );
  if (rows.length === 0) return { exists: false, envelope: null };
  return {
    exists: true,
    envelope: (rows[0].bank_details as EncryptedField | null) ?? null,
  };
}

/** Vendor-side update: only `tradingName` + `addresses` are settable. */
export interface UpdateVendorSelfInput {
  tradingName?: string | null;
  addresses?: Array<Record<string, string | boolean | undefined>>;
}

/** Apply the vendor-side patch to a vendor row by id (no org guard). */
export async function updateVendorSelf(
  vendorId: string,
  patch: UpdateVendorSelfInput
): Promise<VendorSelfView | null> {
  const pool = getPool();
  const setClauses: string[] = [];
  const params: unknown[] = [vendorId];

  if ("tradingName" in patch) {
    params.push(patch.tradingName);
    setClauses.push(`trading_name = $${params.length}`);
  }
  if ("addresses" in patch) {
    params.push(addressesArray(patch.addresses));
    setClauses.push(
      `addresses = COALESCE($${params.length}::jsonb[], '{}'::jsonb[])`
    );
  }
  if (setClauses.length === 0) return await getVendorSelfById(vendorId);

  setClauses.push(`updated_at = now()`);
  const { rowCount } = await pool.query(
    `UPDATE vendor SET ${setClauses.join(", ")} WHERE id = $1`,
    params
  );
  if ((rowCount ?? 0) === 0) return null;
  return await getVendorSelfById(vendorId);
}

/** Bank-details write by vendor_id (no org guard). */
export async function updateVendorBankDetailsById(
  vendorId: string,
  envelope: EncryptedField | null
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE vendor
       SET bank_details = $1, updated_at = now()
     WHERE id = $2`,
    [envelope ? JSON.stringify(envelope) : null, vendorId]
  );
  return (rowCount ?? 0) > 0;
}

/** KYC docs for one vendor (no org guard). */
export async function listKycDocumentsByVendorId(
  vendorId: string
): Promise<VendorKycDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, vendor_id, doc_type, file_url, file_name,
            expires_at, uploaded_by, uploaded_at, notes
       FROM vendor_kyc_document
      WHERE vendor_id = $1
      ORDER BY uploaded_at DESC`,
    [vendorId]
  );
  return rows as VendorKycDocument[];
}

/**
 * Vendor-side KYC upload. Auto-flips `kyc_status` to `pending` unless it's
 * already `pending` — re-uploads after PM verified should trigger re-review.
 */
export async function addKycDocumentBySelf(
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

    const insert = await client.query(
      `WITH v AS (SELECT id, kyc_status FROM vendor WHERE id = $1)
       INSERT INTO vendor_kyc_document
         (vendor_id, doc_type, file_url, file_name, expires_at, uploaded_by, notes)
       SELECT v.id, $2, $3, $4, $5, $6, $7 FROM v
       RETURNING id, vendor_id, doc_type, file_url, file_name,
                 expires_at, uploaded_by, uploaded_at, notes,
                 (SELECT kyc_status FROM v) AS prior_kyc_status`,
      [
        vendorId,
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
    if (priorStatus !== "pending") {
      vendorKycStatus = "pending";
      await client.query(
        `UPDATE vendor SET kyc_status = 'pending', updated_at = now()
           WHERE id = $1`,
        [vendorId]
      );
    }

    await client.query("COMMIT");
    return { document: document as VendorKycDocument, vendorKycStatus };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/** Remove a KYC doc, scoped to a vendor's own docs. */
export async function removeKycDocumentBySelf(
  vendorId: string,
  docId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM vendor_kyc_document
       WHERE id = $1 AND vendor_id = $2`,
    [docId, vendorId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── Vendor self-service contact CRUD ───────────────────────────────────────

export interface VendorContactInput {
  name: string;
  title?: string | null;
  email: string;
  phone?: string | null;
  isPrimary?: boolean;
  receivesRfq?: boolean;
}

export interface VendorContactPatch {
  name?: string;
  title?: string | null;
  email?: string;
  phone?: string | null;
  isPrimary?: boolean;
  receivesRfq?: boolean;
}

/**
 * Append a contact row. When `isPrimary: true`, clears `is_primary` from
 * every other contact in the same vendor to keep the invariant.
 */
export async function addVendorContactSelf(
  vendorId: string,
  input: VendorContactInput
): Promise<{ id: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isPrimary) {
      await client.query(
        `UPDATE vendor_contact SET is_primary = false WHERE vendor_id = $1`,
        [vendorId]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO vendor_contact
         (vendor_id, name, title, email, phone, is_primary, receives_rfq)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
       RETURNING id`,
      [
        vendorId,
        input.name,
        input.title ?? null,
        normalizeEmail(input.email),
        input.phone ?? null,
        !!input.isPrimary,
        input.receivesRfq ?? null,
      ]
    );

    await client.query("COMMIT");
    return { id: rows[0].id as string };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

const CONTACT_PATCH_COLS: Record<keyof VendorContactPatch, string> = {
  name: "name",
  title: "title",
  email: "email",
  phone: "phone",
  isPrimary: "is_primary",
  receivesRfq: "receives_rfq",
};

/** Patch a single contact row, scoped to a specific vendor. */
export async function updateVendorContactSelf(
  vendorId: string,
  contactId: string,
  patch: VendorContactPatch
): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // A linked contact changing its own email must also move the login
    // identity, so a magic-link lands at the new address. Capture the prior
    // link before the update.
    let priorLink: { user_id: string | null; email: string } | null = null;
    if (typeof patch.email === "string") {
      const { rows } = await client.query<{
        user_id: string | null;
        email: string;
      }>(
        `SELECT user_id, email FROM vendor_contact WHERE id = $1 AND vendor_id = $2`,
        [contactId, vendorId]
      );
      priorLink = rows[0] ?? null;
    }

    if (patch.isPrimary === true) {
      await client.query(
        `UPDATE vendor_contact SET is_primary = false
           WHERE vendor_id = $1 AND id <> $2`,
        [vendorId, contactId]
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [contactId, vendorId];
    for (const [key, col] of Object.entries(CONTACT_PATCH_COLS)) {
      const k = key as keyof VendorContactPatch;
      if (k in patch) {
        const value = (patch as Record<string, unknown>)[k];
        params.push(
          k === "email" && typeof value === "string"
            ? normalizeEmail(value)
            : value
        );
        setClauses.push(`${col} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      await client.query("ROLLBACK");
      return true;
    }

    const { rowCount } = await client.query(
      `UPDATE vendor_contact SET ${setClauses.join(", ")}
         WHERE id = $1 AND vendor_id = $2`,
      params
    );

    if (
      priorLink?.user_id &&
      typeof patch.email === "string" &&
      normalizeEmail(patch.email) !== normalizeEmail(priorLink.email)
    ) {
      await updateUserEmail(
        priorLink.user_id,
        normalizeEmail(patch.email),
        client
      );
    }

    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/**
 * Delete a contact, scoped to a vendor's own. Refuses to delete a row that
 * has `user_id` set — that contact is linked to a portal user and removing
 * it would orphan the link. Caller surfaces this as a 409.
 */
export async function deleteVendorContactSelf(
  vendorId: string,
  contactId: string
): Promise<{ ok: true } | { ok: false; reason: "linked" | "not_found" }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT user_id FROM vendor_contact
         WHERE id = $1 AND vendor_id = $2`,
      [contactId, vendorId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }

    if (rows[0].user_id) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "linked" };
    }

    await client.query(
      `DELETE FROM vendor_contact WHERE id = $1 AND vendor_id = $2`,
      [contactId, vendorId]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(mapPgError(err as Parameters<typeof mapPgError>[0]));
  } finally {
    client.release();
  }
}

/**
 * Slim lookup for the invite endpoint — fetches just the contact email and
 * verifies the contact belongs to a vendor in the given org. Avoids the
 * heavy joins in `getVendorById` when only the email is needed.
 */
export async function getVendorContactEmail(
  orgId: string,
  vendorId: string,
  contactId: string
): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT vc.email
     FROM vendor_contact vc
     JOIN vendor v ON v.id = vc.vendor_id
     WHERE vc.id = $1 AND v.id = $2 AND v.org_id = $3`,
    [contactId, vendorId, orgId]
  );
  return row?.email ?? null;
}

/**
 * Backfill `vendor_contact.user_id` for any unlinked contact whose email
 * matches the given user. Case-insensitive (better-auth stores emails
 * lowercased; older contact rows may not be).
 *
 * Idempotent — only updates rows where `user_id IS NULL`.
 */
export async function linkVendorContactByEmail(
  userId: string,
  email: string
): Promise<void> {
  const pool = getPool();
  // TRIM both sides so legacy / CSV-imported rows with stray whitespace still
  // link. better-auth normalises emails to lowercase but doesn't trim.
  await pool.query(
    `UPDATE vendor_contact
     SET user_id = $1
     WHERE TRIM(LOWER(email)) = TRIM(LOWER($2)) AND user_id IS NULL`,
    [userId, email]
  );
}
