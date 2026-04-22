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

const CONFLICT_BODY = {
  error: "This item was updated by another user. Please refresh.",
  code: "OPTIMISTIC_LOCK_CONFLICT" as const,
};

/** PATCH /api/projects/[id]/boq/items/[itemId] — update item with optimistic lock. */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, itemId } = params;

    const owned = await verifyBoqItemOwnership(itemId, id);
    if (!owned) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }

    const parsed = await parseRequest(req, updateBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { updatedAt, ...fields } = parsed.data;

    const outcome = await updateBoqItem(itemId, updatedAt, fields);
    if (outcome.ok) return NextResponse.json(outcome.item);
    if (outcome.reason === "conflict") {
      return NextResponse.json(CONFLICT_BODY, { status: 409 });
    }
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
);

/** DELETE /api/projects/[id]/boq/items/[itemId] — delete item with optimistic lock. */
export const DELETE = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, itemId } = params;

    const owned = await verifyBoqItemOwnership(itemId, id);
    if (!owned) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }

    const parsed = await parseRequest(req, deleteBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const outcome = await deleteBoqItem(itemId, parsed.data.updatedAt);
    if (outcome.ok) return NextResponse.json({ ok: true });
    if (outcome.reason === "conflict") {
      return NextResponse.json(CONFLICT_BODY, { status: 409 });
    }
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
);
