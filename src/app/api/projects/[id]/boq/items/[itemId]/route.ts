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
  async (req, _ctx, params) => {
    const { id, itemId } = params;

    if (!(await verifyBoqItemOwnership(itemId, id))) return notFound();

    const parsed = await parseRequest(req, updateBoqItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { updatedAt, ...fields } = parsed.data;

    const outcome = await updateBoqItem(itemId, updatedAt, fields);
    if (outcome.ok) return NextResponse.json(outcome.item);
    return optimisticFailureResponse(outcome.reason);
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
    return optimisticFailureResponse(outcome.reason);
  }
);
