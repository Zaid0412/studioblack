import { NextResponse } from "next/server";
import { getQuoteDetail } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId] — single quote
 * detail. Verifies the quote belongs to the requested RFQ; cross-RFQ
 * spoofing returns 404.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;
    if (!params.quoteId) {
      return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
    }

    const quote = await getQuoteDetail(params.quoteId);
    if (!quote || quote.rfq_id !== resolved.rfqId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json(quote);
  }
);
