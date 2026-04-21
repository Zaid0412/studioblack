import { NextResponse } from "next/server";
import { restoreElement } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** POST /api/elements/[id]/restore — un-archive a soft-deleted element. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const result = await restoreElement(orgId, params.id);
    if (!result.restored) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
