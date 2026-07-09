import { NextResponse } from "next/server";
import { getRateContractById, getRateContractHistory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import type { RateContractHistoryEvent } from "@/types";

/**
 * GET /api/rate-contracts/[id]/history — activity timeline for a rate contract
 * (every `rate_contract.*` audit event against it, newest first). Backs the
 * Activity section on the RC detail page. Studio-only.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    // 404 on an unknown/foreign contract so history can't be probed cross-org.
    const rc = await getRateContractById(orgId, params.id);
    if (!rc) {
      return NextResponse.json(
        { error: "Rate contract not found" },
        { status: 404 }
      );
    }
    const events = await getRateContractHistory(orgId, params.id);
    return NextResponse.json({
      events: events satisfies RateContractHistoryEvent[],
    });
  }
);
