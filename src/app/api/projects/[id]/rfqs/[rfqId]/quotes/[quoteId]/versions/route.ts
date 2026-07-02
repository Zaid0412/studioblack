import { NextResponse } from "next/server";
import { getQuoteVersionHistory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/versions — every version
 * of this vendor's quote on the RFQ (current + superseded), newest first.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const versions = await getQuoteVersionHistory(
      resolved.rfqId,
      params.quoteId
    );
    return NextResponse.json({ versions });
  }
);
