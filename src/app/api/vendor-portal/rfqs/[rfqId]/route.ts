import { NextResponse } from "next/server";
import { getRfqDetailForVendor } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { ensureVendorPortalEnabled } from "@/lib/vendorPortalGuards";

/**
 * GET /api/vendor-portal/rfqs/[rfqId] — RFQ detail scoped to the caller's
 * own vendor. Returns 404 when the vendor isn't on the rfq_vendor list so
 * vendors can't probe for RFQ ids they weren't invited to.
 */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

    if (!params.rfqId) {
      return NextResponse.json({ error: "Missing rfqId" }, { status: 400 });
    }

    const detail = await getRfqDetailForVendor(params.rfqId, vendorId!);
    if (!detail) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
);
