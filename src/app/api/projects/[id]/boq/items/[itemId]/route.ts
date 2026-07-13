import { NextResponse } from "next/server";
import {
  deleteBoqItem,
  updateBoqItem,
  verifyBoqItemOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  updateBoqItemSchema,
  deleteBoqItemSchema,
} from "@/lib/validations";
import { notFoundResponse, optimisticFailureResponse } from "../../_helpers";

const notFound = () => notFoundResponse("Item not found in this project");

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { user, orgId }, params) => {
    const { id, itemId } = params;
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    if (!(await verifyBoqItemOwnership(itemId, id))) return notFound();

    const parsed = await parseRequest(req, updateBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { updatedAt, ...fields } = parsed.data;

    try {
      const outcome = await updateBoqItem(
        itemId,
        orgId,
        updatedAt,
        fields,
        user.id
      );
      if (outcome.ok) return NextResponse.json(outcome.item);
      return optimisticFailureResponse(outcome.reason);
    } catch (err) {
      // requireServiceArea throws a plain Error — surface its message rather
      // than letting it escape as a 500.
      const message =
        err instanceof Error ? err.message : "Failed to update item";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);

export const DELETE = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, itemId } = params;

    if (!(await verifyBoqItemOwnership(itemId, id))) return notFound();

    const parsed = await parseRequest(req, deleteBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const outcome = await deleteBoqItem(itemId, parsed.data.updatedAt);
    if (outcome.ok) return NextResponse.json({ ok: true });
    if (outcome.reason === "in_rfq") {
      return NextResponse.json(
        {
          error:
            "This item is part of an RFQ. Remove it from scope instead of deleting it.",
        },
        { status: 422 }
      );
    }
    return optimisticFailureResponse(outcome.reason);
  }
);
