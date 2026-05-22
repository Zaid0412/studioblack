import { NextResponse } from "next/server";
import { getQuotesByRfq } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes — every quote on this RFQ
 * with line items joined. Sweeps expired quotes before returning so the
 * caller sees `status='expired'` consistently. Order: on-time first
 * (is_late ASC), then by submission time.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const quotes = await getQuotesByRfq(resolved.rfqId);
    return NextResponse.json({ quotes });
  }
);
