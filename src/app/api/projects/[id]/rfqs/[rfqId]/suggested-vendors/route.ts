import { NextResponse } from "next/server";
import { getAllVendorsForRfq, getSuggestedVendorsForRfq } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/suggested-vendors — vendors whose
 * registered trades match the categories of this RFQ's items. PM/architect
 * only; clients and vendors are blocked by `withAuth`.
 *
 * `?all=true` drops the trade filter and returns every active vendor in the
 * org — the "Show all vendors" escape hatch in the issue/invite dialog.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const all = new URL(req.url).searchParams.get("all") === "true";
    const vendors = all
      ? await getAllVendorsForRfq(resolved.rfqId)
      : await getSuggestedVendorsForRfq(resolved.rfqId);
    return NextResponse.json({ vendors });
  }
);
