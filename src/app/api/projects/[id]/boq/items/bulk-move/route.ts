import { NextResponse } from "next/server";
import { moveBoqItemsBulk } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { bulkMoveBoqItemsSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

/**
 * POST /api/projects/[id]/boq/items/bulk-move
 *
 * Move many BOQ items to the same target section in a single transaction.
 * Body: `{ boqId, itemIds, targetSectionId | null }`. Items receive
 * successive `sort_order` values starting at the target bucket's MAX+1,
 * in the order supplied. Returns the updated rows in the same order so
 * the client can patch its SWR cache without re-fetching.
 *
 * Locked-BOQ guard via `parseBoqRequest`. Cross-BOQ target → 400.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(
      req,
      params.id,
      bulkMoveBoqItemsSchema
    );
    if (!result.ok) return result.response;

    const outcome = await moveBoqItemsBulk(
      result.data.itemIds,
      result.boqId,
      result.data.targetSectionId
    );
    if (outcome.ok) return NextResponse.json({ items: outcome.items });

    if (outcome.reason === "wrong_boq") {
      return NextResponse.json(
        {
          error: "Target section is not in this BOQ.",
          code: "WRONG_BOQ" as const,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "One or more items were not found in this BOQ." },
      { status: 404 }
    );
  }
);
