import { NextResponse } from "next/server";
import {
  transitionRateContract,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, transitionRateContractSchema } from "@/lib/validations";

/**
 * POST /api/rate-contracts/[id]/transition — advance the contract through its
 * lifecycle via a single action (submit/approve/activate/…). The state machine
 * + per-action role rules live in transitionRateContract.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user, effectiveRole }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, transitionRateContractSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await transitionRateContract(
      orgId,
      params.id,
      parsed.data.action,
      { userId: user.id, role: effectiveRole }
    );
    if (!result.ok) {
      const map: Record<string, [number, string]> = {
        not_found: [404, "Rate contract not found"],
        forbidden: [403, "You don't have permission for this action"],
        empty: [409, "Add at least one item before activating"],
        invalid_status_transition: [
          409,
          "That action isn't allowed from the current status",
        ],
      };
      const [status, error] = map[result.reason] ?? [400, result.reason];
      return NextResponse.json({ error }, { status });
    }

    await logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.RATE_CONTRACT_TRANSITIONED,
      targetTable: "rate_contract",
      targetId: params.id,
      metadata: { action: parsed.data.action, status: result.row.status },
    });

    return NextResponse.json(result.row);
  }
);
