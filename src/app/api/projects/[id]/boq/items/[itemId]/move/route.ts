import { NextResponse } from "next/server";
import { moveBoqItem } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, moveBoqItemSchema } from "@/lib/validations";
import {
  assertItemEditable,
  optimisticFailureResponse,
} from "../../../_helpers";

/**
 * POST /api/projects/[id]/boq/items/[itemId]/move
 *
 * Move a BOQ item into a different section in the same BOQ. Appends to
 * the bottom of the target section. Optimistic-locked on `updatedAt`.
 *
 * Cross-BOQ moves are rejected (400) — they'd break cost / version
 * semantics. The locked-BOQ guard is enforced via `assertItemEditable`.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, itemId } = params;

    const gate = await assertItemEditable(itemId, id);
    if (gate) return gate;

    const parsed = await parseRequest(req, moveBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { updatedAt, targetSectionId } = parsed.data;

    const outcome = await moveBoqItem(itemId, targetSectionId, updatedAt);
    if (outcome.ok) return NextResponse.json(outcome.item);
    if (outcome.reason === "wrong_boq") {
      return NextResponse.json(
        {
          error: "Target section is not in the same BOQ as the item.",
          code: "WRONG_BOQ" as const,
        },
        { status: 400 }
      );
    }
    return optimisticFailureResponse(outcome.reason);
  }
);
