import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  removeKycDocumentBySelf,
  logAuditSafe,
  AUDIT_ACTIONS,
  AUDIT_SOURCES,
} from "@/lib/queries";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/**
 * DELETE /api/vendor-portal/me/kyc-documents/[docId] — vendor removes one of
 * their own KYC docs. The DELETE statement scopes by `vendor_id`, so a
 * cross-tenant doc id 404s.
 */
export const DELETE = withAuth(
  {
    allowedRoles: ["vendor"],
    fetchVendorId: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (_req, { user, orgId, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    const ok = await removeKycDocumentBySelf(vendorId!, params.docId);
    if (!ok) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.VENDOR_KYC_DOCUMENT_REMOVED,
        targetTable: "vendor",
        targetId: vendorId!,
        metadata: {
          doc_id: params.docId,
          source: AUDIT_SOURCES.SELF_SERVICE,
        },
      });
    }
    return NextResponse.json({ success: true });
  }
);
