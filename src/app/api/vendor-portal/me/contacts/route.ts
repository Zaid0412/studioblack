import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { addVendorContactSelf } from "@/lib/queries";
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
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (req, { user, vendorId }) => {
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
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add contact";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
