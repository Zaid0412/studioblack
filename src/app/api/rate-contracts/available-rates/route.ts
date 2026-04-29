import { NextResponse } from "next/server";
import { getAvailableRatesForBoqPicker } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/rate-contracts/available-rates — flat list of every active rate
 * contract item across the org. Used by the BOQ picker's "From Rate Contract"
 * tab. Capped at 200 rows; clients should pass `?search=` to narrow further.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ rates: [] });
    }
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const rates = await getAvailableRatesForBoqPicker(orgId, search);
    return NextResponse.json({ rates });
  }
);
