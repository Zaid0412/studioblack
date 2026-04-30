import { NextResponse } from "next/server";
import {
  activateRateContract,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** POST /api/rate-contracts/[id]/activate — flip draft → active. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const result = await activateRateContract(orgId, params.id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Rate contract not found" },
          { status: 404 }
        );
      }
      if (result.reason === "empty") {
        return NextResponse.json(
          { error: "Add at least one item before activating" },
          { status: 409 }
        );
      }
      if (result.reason === "invalid_status_transition") {
        return NextResponse.json(
          { error: "Only draft contracts can be activated" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    await logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.RATE_CONTRACT_ACTIVATED,
      targetTable: "rate_contract",
      targetId: params.id,
    });

    return NextResponse.json({ success: true });
  }
);
