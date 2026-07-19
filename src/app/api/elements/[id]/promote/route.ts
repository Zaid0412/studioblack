import { NextResponse } from "next/server";
import { promoteElement } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * POST /api/elements/[id]/promote — promote a Custom element to Company Standard
 * (PRD 2.2). 404 if the element isn't in this org or isn't Custom.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const element = await promoteElement(orgId, params.id);
    if (!element) {
      return NextResponse.json(
        { error: "Element not found or not a Custom element" },
        { status: 404 }
      );
    }
    return NextResponse.json(element);
  }
);
