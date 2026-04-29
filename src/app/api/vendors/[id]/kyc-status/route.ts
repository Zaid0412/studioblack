import { NextResponse } from "next/server";
import { setKycStatus, logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, vendorKycStatusSchema } from "@/lib/validations";

/**
 * PATCH /api/vendors/[id]/kyc-status — flip the vendor's verification state.
 * PM only: verification is a financial-control decision, not operational.
 */
export const PATCH = withAuth(
  { allowedRoles: ["pm"] },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, vendorKycStatusSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await setKycStatus(
      orgId,
      params.id,
      parsed.data.kycStatus,
      parsed.data.kycNotes ?? null,
      user.id
    );
    if (!updated) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    await logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.VENDOR_KYC_STATUS_CHANGED,
      targetTable: "vendor",
      targetId: params.id,
      metadata: { kyc_status: parsed.data.kycStatus },
    });

    return NextResponse.json(updated);
  }
);
