import { NextResponse } from "next/server";
import { removeKycDocument, logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * DELETE /api/vendors/[id]/kyc-documents/[docId] — remove the row.
 * The underlying storage object is left as-is (matches attachment soft-path).
 */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const ok = await removeKycDocument(orgId, params.id, params.docId);
    if (!ok) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    await logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.VENDOR_KYC_DOCUMENT_REMOVED,
      targetTable: "vendor",
      targetId: params.id,
      metadata: { doc_id: params.docId },
    });

    return NextResponse.json({ success: true });
  }
);
