import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  logAuditSafe,
  removeRateContractItem,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** DELETE /api/rate-contracts/[id]/items/[itemId] — remove a single item. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const ok = await removeRateContractItem(orgId, params.id, params.itemId);
    if (!ok) {
      return NextResponse.json(
        { error: "Rate contract item not found" },
        { status: 404 }
      );
    }
    void logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.RATE_CONTRACT_ITEM_REMOVED,
      targetTable: "rate_contract",
      targetId: params.id,
      metadata: { item_id: params.itemId },
    });
    return NextResponse.json({ success: true });
  }
);
