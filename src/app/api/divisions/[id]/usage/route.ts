import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDivisionUsage } from "@/lib/queries";

/**
 * GET /api/divisions/[id]/usage — projects (+ line-item / section counts) that
 * reference the division. Drives the "can't delete, here's where it's used"
 * breakdown in the delete dialog. Empty ⇒ safe to delete.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const usage = await getDivisionUsage(params.id, orgId);
    return NextResponse.json({ usage });
  }
);
