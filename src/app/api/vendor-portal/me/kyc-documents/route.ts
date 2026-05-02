import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  addKycDocumentBySelf,
  listKycDocumentsByVendorId,
} from "@/lib/queries";
import { parseRequest, vendorKycDocumentSchema } from "@/lib/validations";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/** GET /api/vendor-portal/me/kyc-documents — list vendor's own KYC documents. */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const documents = await listKycDocumentsByVendorId(vendorId!);
    return NextResponse.json({ documents });
  }
);

/**
 * POST /api/vendor-portal/me/kyc-documents — vendor adds a KYC document.
 * Auto-flips `kyc_status` to `pending` (unless already pending) so PMs see
 * something to re-verify after the upload.
 */
export const POST = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    const parsed = await parseRequest(req, vendorKycDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const result = await addKycDocumentBySelf(vendorId!, user.id, {
        docType: parsed.data.docType,
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        expiresAt: parsed.data.expiresAt ?? null,
        notes: parsed.data.notes ?? null,
      });
      if (!result) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          document: result.document,
          vendor_kyc_status: result.vendorKycStatus,
        },
        { status: 201 }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add KYC document";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
