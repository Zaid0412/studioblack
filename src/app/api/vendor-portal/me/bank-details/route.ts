import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getVendorBankDetailsEnvelopeById,
  updateVendorBankDetailsById,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { bankDetailsSchema } from "@/lib/validations";
import {
  encryptBankDetails,
  decryptBankDetails,
  isEncryptedField,
} from "@/lib/vendorEncryption";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/**
 * GET /api/vendor-portal/me/bank-details — vendor reads their own decrypted
 * bank details. Unlike the PM-side equivalent, no audit log entry — vendor
 * reading their own data isn't a sensitive cross-tenant event.
 */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const { exists, envelope } = await getVendorBankDetailsEnvelopeById(
      vendorId!
    );
    if (!exists) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    if (!envelope) return NextResponse.json({ data: null });
    if (!isEncryptedField(envelope)) {
      return NextResponse.json(
        { error: "Stored bank details are malformed" },
        { status: 500 }
      );
    }
    try {
      return NextResponse.json({ data: decryptBankDetails(envelope) });
    } catch {
      return NextResponse.json(
        { error: "Failed to decrypt bank details" },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/vendor-portal/me/bank-details — encrypt + store. `null` clears.
 * Body shape is `{ data: BankDetails | null }` to match the PM-side endpoint.
 */
export const PUT = withAuth(
  {
    allowedRoles: ["vendor"],
    fetchVendorId: true,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { user, orgId, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      return NextResponse.json(
        { error: "Body must be { data: BankDetails | null }" },
        { status: 400 }
      );
    }
    const wrapped = (body as { data: unknown }).data;

    if (wrapped === null) {
      const ok = await updateVendorBankDetailsById(vendorId!, null);
      if (!ok) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      if (orgId) {
        await logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.VENDOR_BANK_CLEAR,
          targetTable: "vendor",
          targetId: vendorId!,
          metadata: { source: "self_service" },
        });
      }
      return NextResponse.json({ success: true });
    }

    const parsed = bankDetailsSchema.safeParse(wrapped);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    let envelope;
    try {
      envelope = encryptBankDetails(parsed.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Encryption unavailable";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const ok = await updateVendorBankDetailsById(vendorId!, envelope);
    if (!ok) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    if (orgId) {
      await logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.VENDOR_BANK_WRITE,
        targetTable: "vendor",
        targetId: vendorId!,
        metadata: { source: "self_service" },
      });
    }
    return NextResponse.json({ success: true });
  }
);
