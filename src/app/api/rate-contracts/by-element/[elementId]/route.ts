import { NextResponse } from "next/server";
import { getActiveRatesForElement } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/rate-contracts/by-element/[elementId] — active rates available
 * for an element across contracts (sorted lowest first). Optional
 * `?vendorId=` scopes to one vendor. Used by the BOQ "From Rate Contract"
 * picker tab.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ rates: [] });
    }
    const vendorId = req.nextUrl.searchParams.get("vendorId") ?? undefined;
    const rates = await getActiveRatesForElement(
      orgId,
      params.elementId,
      vendorId
    );
    return NextResponse.json({ rates });
  }
);
