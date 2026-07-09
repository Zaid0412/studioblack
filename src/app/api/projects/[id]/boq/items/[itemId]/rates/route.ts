import { NextResponse } from "next/server";
import {
  getActiveRatesForBoqItemById,
  verifyBoqItemOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/projects/[id]/boq/items/[itemId]/rates — active rates that apply to
 * this BOQ item, resolved from its service area (its element's category, or a
 * free-text line's own category). Unlike the element-keyed by-element endpoint,
 * this also surfaces rates for unclassified-by-element (free-text) lines.
 * Most-specific + cheapest first. Optional `?vendorId=` scopes to one vendor.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"], projectAccess: true },
  async (req, { orgId }, params) => {
    const { id, itemId } = params;
    if (!orgId) {
      return NextResponse.json({ rates: [] });
    }
    if (!(await verifyBoqItemOwnership(itemId, id))) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }
    const vendorId = req.nextUrl.searchParams.get("vendorId") ?? undefined;
    const rates = await getActiveRatesForBoqItemById(orgId, itemId, vendorId);
    return NextResponse.json({ rates });
  }
);
