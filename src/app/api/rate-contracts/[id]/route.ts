import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getRateContractById,
  logAuditSafe,
  updateRateContract,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateRateContractSchema } from "@/lib/validations";

/** GET /api/rate-contracts/[id] — full record with items. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const row = await getRateContractById(orgId, params.id);
    if (!row) {
      return NextResponse.json(
        { error: "Rate contract not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(row);
  }
);

/** PATCH /api/rate-contracts/[id] — update header (allow-list once active). */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, updateRateContractSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await updateRateContract(orgId, params.id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Rate contract not found" },
          { status: 404 }
        );
      }
      if (result.reason === "active_locked") {
        return NextResponse.json(
          {
            error:
              "Active rate contracts can only be edited in notes / terms / agreement / payment-terms",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    void logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.RATE_CONTRACT_UPDATED,
      targetTable: "rate_contract",
      targetId: params.id,
      metadata: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json(result.row);
  }
);
