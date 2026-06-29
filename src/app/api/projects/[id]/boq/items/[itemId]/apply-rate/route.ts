import { NextResponse } from "next/server";
import {
  applyRateContractToBoqItem,
  verifyBoqItemOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, applyRateToBoqItemSchema } from "@/lib/validations";
import { notFoundResponse, optimisticFailureResponse } from "../../../_helpers";

/**
 * POST /api/projects/[id]/boq/items/[itemId]/apply-rate — apply an active
 * rate-contract rate to this BOQ item. The rate must cover the item's element
 * (exact element, its service area, or an ancestor category).
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    const { id, itemId } = params;
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    if (!(await verifyBoqItemOwnership(itemId, id))) {
      return notFoundResponse("Item not found in this project");
    }

    const parsed = await parseRequest(req, applyRateToBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const outcome = await applyRateContractToBoqItem(
      orgId,
      itemId,
      parsed.data.rateContractItemId,
      parsed.data.updatedAt
    );
    if (outcome.ok) return NextResponse.json(outcome.item);
    if (outcome.reason === "no_element") {
      return NextResponse.json(
        { error: "This item has no element to match a rate against" },
        { status: 400 }
      );
    }
    if (outcome.reason === "rate_not_applicable") {
      return NextResponse.json(
        { error: "That rate doesn't cover this item" },
        { status: 400 }
      );
    }
    return optimisticFailureResponse(outcome.reason);
  }
);
