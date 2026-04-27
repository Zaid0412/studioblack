import { NextResponse } from "next/server";
import { getVendorsByTrade } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/vendors/by-trade/[categoryId] — active vendors that handle the given
 * element category. Used by F9 RFQ vendor suggestion.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ rows: [] });
    }

    const rows = await getVendorsByTrade(orgId, params.categoryId);
    return NextResponse.json({ rows });
  }
);
