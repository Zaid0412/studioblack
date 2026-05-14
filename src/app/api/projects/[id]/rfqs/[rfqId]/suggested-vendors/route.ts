import { NextResponse } from "next/server";
import { getSuggestedVendorsForRfq } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/suggested-vendors — vendors whose
 * registered trades match the categories of this RFQ's items. PM/architect
 * only; clients and vendors are blocked by `withAuth`.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const vendors = await getSuggestedVendorsForRfq(resolved.rfqId);
    return NextResponse.json({ vendors });
  }
);
