import { NextResponse } from "next/server";
import { setStepEnabled } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, toggleStepSchema } from "@/lib/validations";

/** PATCH /api/projects/[id]/steps/[stepId] — enable/disable a workflow step (non-destructive). */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, stepId } = params;

    const parsed = await parseRequest(req, toggleStepSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await setStepEnabled(id, stepId, parsed.data.enabled);
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update step";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
