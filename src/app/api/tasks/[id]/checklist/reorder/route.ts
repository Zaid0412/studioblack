import { NextResponse } from "next/server";
import { reorderChecklistItems } from "@/lib/queries";
import { parseRequest, reorderChecklistSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";
import { guardTaskAccess } from "../../../helpers";

/** PATCH /api/tasks/[id]/checklist/reorder — bulk-update checklist item positions. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    try {
      const taskId = params.id;
      const guard = await guardTaskAccess(taskId, orgId);
      if (guard instanceof NextResponse) return guard;

      const parsed = await parseRequest(req, reorderChecklistSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { orderedIds } = parsed.data;

      await reorderChecklistItems(taskId, orderedIds);

      return NextResponse.json({ ok: true });
    } catch (err) {
      logger.error("Checklist reorder error", {
        taskId: params.id,
        error: err,
      });
      return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    }
  }
);
