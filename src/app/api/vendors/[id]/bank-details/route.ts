import { NextResponse } from "next/server";
import {
  getVendorBankDetailsEnvelope,
  updateVendorBankDetails,
  logAudit,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, bankDetailsSchema } from "@/lib/validations";
import {
  encryptBankDetails,
  decryptBankDetails,
  isEncryptedField,
} from "@/lib/vendorEncryption";
import { logger } from "@/lib/logger";

/**
 * GET /api/vendors/[id]/bank-details — decrypt and return plain bank details.
 * PM only. Logged to audit_event.
 */
export const GET = withAuth(
  { allowedRoles: ["pm"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const { exists, envelope } = await getVendorBankDetailsEnvelope(
      orgId,
      params.id
    );
    if (!exists) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Audit logged whether the row had data or not — both reads are sensitive.
    try {
      await logAudit({
        orgId,
        actorId: user.id,
        action: "vendor.bank_details.read",
        targetTable: "vendor",
        targetId: params.id,
        metadata: { had_data: envelope !== null },
      });
    } catch (err) {
      logger.warn("audit log failed", { err: String(err) });
    }

    if (!envelope) {
      return NextResponse.json({ data: null });
    }

    if (!isEncryptedField(envelope)) {
      return NextResponse.json(
        { error: "Stored bank details are malformed" },
        { status: 500 }
      );
    }

    try {
      const decrypted = decryptBankDetails(envelope);
      return NextResponse.json({ data: decrypted });
    } catch {
      return NextResponse.json(
        { error: "Failed to decrypt bank details" },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/vendors/[id]/bank-details — encrypt and store. Pass `null` to clear.
 * PM only. Logged to audit_event.
 */
export const PUT = withAuth(
  { allowedRoles: ["pm"] },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Strict shape: `{ data: BankDetails | null }`. The client wrapper always
    // sends this envelope; rejecting anything else keeps a sensitive endpoint
    // honest and prevents silent shape-drift.
    if (!body || typeof body !== "object" || !("data" in body)) {
      return NextResponse.json(
        { error: "Body must be { data: BankDetails | null }" },
        { status: 400 }
      );
    }
    const wrapped = (body as { data: unknown }).data;

    if (wrapped === null) {
      const ok = await updateVendorBankDetails(orgId, params.id, null);
      if (!ok) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      try {
        await logAudit({
          orgId,
          actorId: user.id,
          action: "vendor.bank_details.clear",
          targetTable: "vendor",
          targetId: params.id,
        });
      } catch (err) {
        logger.warn("audit log failed", { err: String(err) });
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

    const ok = await updateVendorBankDetails(orgId, params.id, envelope);
    if (!ok) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    try {
      await logAudit({
        orgId,
        actorId: user.id,
        action: "vendor.bank_details.write",
        targetTable: "vendor",
        targetId: params.id,
      });
    } catch (err) {
      logger.warn("audit log failed", { err: String(err) });
    }

    return NextResponse.json({ success: true });
  }
);
