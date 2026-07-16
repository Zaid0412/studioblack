import { NextResponse } from "next/server";
import { reorderDivisions } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, reorderDivisionsSchema } from "@/lib/validations";

/** PATCH /api/divisions/reorder — set the display order of the org's divisions. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, reorderDivisionsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await reorderDivisions(orgId, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  }
);
