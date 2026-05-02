import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { removeKycDocumentBySelf } from "@/lib/queries";
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
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }, params) => {
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
    return NextResponse.json({ success: true });
  }
);
