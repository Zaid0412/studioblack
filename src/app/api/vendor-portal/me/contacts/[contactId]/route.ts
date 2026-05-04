import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  updateVendorContactSelf,
  deleteVendorContactSelf,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import {
  parseRequest,
  vendorPortalContactPatchSchema,
} from "@/lib/validations";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/** PATCH /api/vendor-portal/me/contacts/[contactId] — edit one contact row. */
export const PATCH = withAuth(
  {
    allowedRoles: ["vendor"],
    fetchVendorId: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user, orgId, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    const parsed = await parseRequest(req, vendorPortalContactPatchSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const ok = await updateVendorContactSelf(
        vendorId!,
        params.contactId,
        parsed.data
      );
      if (!ok) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }
      if (orgId) {
        await logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.VENDOR_CONTACT_UPDATED,
          targetTable: "vendor",
          targetId: vendorId!,
          metadata: {
            contact_id: params.contactId,
            fields: Object.keys(parsed.data),
            source: "self_service",
          },
        });
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update contact";
      const status = /duplicate|already exists/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);

/**
 * DELETE /api/vendor-portal/me/contacts/[contactId] — remove a contact row.
 * Refuses if the contact has `user_id` set (linked to a portal user); the PM
 * has to handle that case to avoid orphaning the link.
 */
export const DELETE = withAuth(
  {
    allowedRoles: ["vendor"],
    fetchVendorId: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (_req, { user, orgId, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    const result = await deleteVendorContactSelf(vendorId!, params.contactId);
    if (result.ok) {
      if (orgId) {
        await logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.VENDOR_CONTACT_REMOVED,
          targetTable: "vendor",
          targetId: vendorId!,
          metadata: { contact_id: params.contactId, source: "self_service" },
        });
      }
      return NextResponse.json({ success: true });
    }
    if (result.reason === "linked") {
      return NextResponse.json(
        {
          error: "Cannot remove a contact linked to a portal user",
          code: "contact_linked",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
);
