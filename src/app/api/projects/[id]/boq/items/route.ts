import { NextResponse } from "next/server";
import {
  createBoqItem,
  insertBoqItemBetween,
  NeedsRenumberError,
  requireServiceArea,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { createBoqItemSchema } from "@/lib/validations";
import { parseBoqRequest } from "../_helpers";

export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const result = await parseBoqRequest(req, params.id, createBoqItemSchema);
    if (!result.ok) return result.response;

    try {
      // The gate lives here, not in `createBoqItem`: this is where a user picks
      // a category. The internal callers (`addElementsToBoq`, apply-rate) copy
      // it from an element that was already gated on write — re-checking them
      // would cost a query per row in a batch, and would make adding a
      // *grandfathered* element to a BOQ fail outright.
      await requireServiceArea(getPool(), orgId, result.data.categoryId);

      const { anchorItemId, insertPosition, allowRenumber, ...itemInput } =
        result.data;
      const item = anchorItemId
        ? await insertBoqItemBetween(
            result.boqId,
            orgId,
            { itemId: anchorItemId, position: insertPosition ?? "below" },
            itemInput,
            { allowRenumber }
          )
        : await createBoqItem(result.boqId, orgId, itemInput);
      return NextResponse.json(item, { status: 201 });
    } catch (err) {
      // A full section with no gap left needs the user's OK to renumber — tell
      // the client so it can ask and retry with allowRenumber.
      if (err instanceof NeedsRenumberError) {
        return NextResponse.json({ needsRenumber: true }, { status: 409 });
      }
      // requireServiceArea throws a plain Error — surface its message rather
      // than letting it escape as a 500.
      const message =
        err instanceof Error ? err.message : "Failed to create item";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
