import { NextResponse } from "next/server";
import { getDivisions, createDivision } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createDivisionSchema } from "@/lib/validations";

/** GET /api/divisions — the org's BOQ division library, ordered for display. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ divisions: [] });
    }
    const divisions = await getDivisions(orgId);
    return NextResponse.json({ divisions });
  }
);

/** POST /api/divisions — add a division to the library. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, createDivisionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const division = await createDivision(orgId, parsed.data);
      return NextResponse.json(division, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create division";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
