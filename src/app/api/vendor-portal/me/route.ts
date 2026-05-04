import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getVendorSelfById,
  updateVendorSelf,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { parseRequest, vendorPortalUpdateSchema } from "@/lib/validations";
import {
  ensureVendorPortalEnabled,
  ensureVendorActive,
} from "@/lib/vendorPortalGuards";

/**
 * GET /api/vendor-portal/me — vendor's own record + a `suspended` flag for
 * the profile page to render its read-only banner. Suspended vendors can
 * still read; only writes are blocked.
 */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const vendor = await getVendorSelfById(vendorId!);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({
      vendor,
      suspended: vendor.status !== "active",
    });
  }
);

/** PATCH /api/vendor-portal/me — update the whitelisted self-editable fields. */
export const PATCH = withAuth(
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

    const parsed = await parseRequest(req, vendorPortalUpdateSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateVendorSelf(vendorId!, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    if (orgId) {
      await logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.VENDOR_PROFILE_UPDATED,
        targetTable: "vendor",
        targetId: vendorId!,
        metadata: { fields: Object.keys(parsed.data) },
      });
    }
    return NextResponse.json({ vendor: updated });
  }
);
