import { NextResponse } from "next/server";
import { deleteBoqItemsBulk } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { bulkDeleteBoqItemsSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

/**
 * POST /api/projects/[id]/boq/items/bulk-delete
 *
 * Delete many BOQ items in one statement, scoped to the supplied `boqId`
 * so a forged itemId list can't reach into other projects' BOQs.
 * Body: `{ boqId, itemIds }`. Returns `{ deletedCount }`.
 *
 * Locked-BOQ guard via `parseBoqRequest`.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(
      req,
      params.id,
      bulkDeleteBoqItemsSchema
    );
    if (!result.ok) return result.response;

    const deletedCount = await deleteBoqItemsBulk(
      result.data.itemIds,
      result.boqId
    );
    return NextResponse.json({ deletedCount });
  }
);
