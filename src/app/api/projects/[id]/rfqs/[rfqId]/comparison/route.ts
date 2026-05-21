import { NextResponse } from "next/server";
import { getQuoteComparison } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/comparison — denormalised
 * side-by-side comparison shape. Rows = RFQ items, columns = vendors
 * that submitted a quote (sorted by grand_total ASC, expired last).
 * Lowest-price marker is computed per row. Includes the list of
 * invited vendors that have not yet responded.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const comparison = await getQuoteComparison(resolved.rfqId);
    return NextResponse.json(comparison);
  }
);
