import { NextResponse } from "next/server";
import { setPhaseEnabled } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, toggleEnabledSchema } from "@/lib/validations";

/** PATCH /api/projects/[id]/phases/[phaseId] — enable/disable a phase (non-destructive). */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, phaseId } = params;

    const parsed = await parseRequest(req, toggleEnabledSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await setPhaseEnabled(id, phaseId, parsed.data.enabled);
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update phase";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
