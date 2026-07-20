import { NextResponse } from "next/server";
import { getVendorDashboard } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { ensureVendorPortalEnabled } from "@/lib/vendorPortalGuards";

/** GET /api/vendor-portal/dashboard — aggregated KPIs, quote outcomes, and RFQs awaiting this vendor's response. */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    const data = await getVendorDashboard(vendorId!);
    return NextResponse.json(data);
  }
);
