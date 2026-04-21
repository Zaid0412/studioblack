import { NextResponse } from "next/server";
import { duplicateElement } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** POST /api/elements/[id]/duplicate — clone an element with a new code. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    try {
      const copy = await duplicateElement(orgId, user.id, params.id);
      if (!copy) {
        return NextResponse.json(
          { error: "Element not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(copy, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to duplicate element";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
