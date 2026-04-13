import { NextResponse } from "next/server";
import { updateChecklistItem, deleteChecklistItem } from "@/lib/queries";
import { parseRequest, updateChecklistItemSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";
import { guardTaskAccess } from "../../../helpers";

/** PATCH /api/tasks/[id]/checklist/[itemId] — update a checklist item. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    const { id: taskId, itemId } = params;
    const guard = await guardTaskAccess(taskId, orgId);
    if (guard instanceof NextResponse) return guard;

    const parsed = await parseRequest(req, updateChecklistItemSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { title, is_done, position } = parsed.data;

    if (
      title === undefined &&
      is_done === undefined &&
      position === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await updateChecklistItem(itemId, taskId, {
      title,
      is_done,
      position,
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }
);

/** DELETE /api/tasks/[id]/checklist/[itemId] — delete a checklist item. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const { id: taskId, itemId } = params;
    const guard = await guardTaskAccess(taskId, orgId);
    if (guard instanceof NextResponse) return guard;

    const deleted = await deleteChecklistItem(itemId, taskId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
