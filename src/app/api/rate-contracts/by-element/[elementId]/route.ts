import { NextResponse } from "next/server";
import { getActiveRatesForBoqItem } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/rate-contracts/by-element/[elementId] — active rates that apply to
 * a BOQ item's element: an exact element rate, a rate on the element's service
 * area, or a rate on an ancestor category. Most-specific + cheapest first, each
 * tagged with `match_type`. Optional `?vendorId=` scopes to one vendor.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ rates: [] });
    }
    const vendorId = req.nextUrl.searchParams.get("vendorId") ?? undefined;
    const rates = await getActiveRatesForBoqItem(
      orgId,
      { elementId: params.elementId },
      vendorId
    );
    return NextResponse.json({ rates });
  }
);
