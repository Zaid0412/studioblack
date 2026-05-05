import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  addVendorContactSelf,
  logAuditSafe,
  AUDIT_ACTIONS,
  AUDIT_SOURCES,
} from "@/lib/queries";
import {
  parseRequest,
  vendorPortalContactCreateSchema,
} from "@/lib/validations";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/** POST /api/vendor-portal/me/contacts — append a contact row. */
export const POST = withAuth(
  {
    allowedRoles: ["vendor"],
    fetchVendorId: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (req, { user, orgId, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    const parsed = await parseRequest(req, vendorPortalContactCreateSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const created = await addVendorContactSelf(vendorId!, parsed.data);
      if (orgId) {
        void logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.VENDOR_CONTACT_ADDED,
          targetTable: "vendor",
          targetId: vendorId!,
          metadata: {
            contact_id: created.id,
            email: parsed.data.email,
            source: AUDIT_SOURCES.SELF_SERVICE,
          },
        });
      }
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add contact";
      // Duplicate-email conflicts surface as a 409, anything else is a 400.
      const status = /duplicate|already exists/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);
