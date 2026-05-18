import { NextResponse } from "next/server";
import { removeRfqItem } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../../_helpers";

/**
 * DELETE /api/projects/[id]/rfqs/[rfqId]/items/[itemId] — remove one item
 * from a draft RFQ. Same status rules as add (draft only).
 */
export const DELETE = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    if (!params.itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const result = await removeRfqItem(resolved.rfqId, params.itemId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Items can only be removed while the RFQ is in draft" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }
);
