import { NextResponse } from "next/server";
import {
  addKycDocument,
  listKycDocuments,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, vendorKycDocumentSchema } from "@/lib/validations";

/** GET /api/vendors/[id]/kyc-documents — list KYC documents for a vendor. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const documents = await listKycDocuments(orgId, params.id);
    return NextResponse.json({ documents });
  }
);

/**
 * POST /api/vendors/[id]/kyc-documents — record a KYC document upload.
 * The file itself is uploaded via /api/upload/signed-url first; this only
 * persists the metadata + URL. Auto-flips vendor.kyc_status from
 * 'unverified' → 'pending' on first document.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, vendorKycDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const result = await addKycDocument(orgId, params.id, user.id, {
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

      await logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.VENDOR_KYC_DOCUMENT_ADDED,
        targetTable: "vendor",
        targetId: params.id,
        metadata: {
          doc_type: parsed.data.docType,
          kyc_status: result.vendorKycStatus,
        },
      });

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
