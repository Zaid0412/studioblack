import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDesignDisciplines } from "@/lib/queries";

/**
 * GET /api/design-disciplines
 *
 * The org's design disciplines (Architecture, Structural, …), ordered for
 * display. Document Control module, PR-1.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ disciplines: [] });
    }
    const disciplines = await getDesignDisciplines(orgId);
    return NextResponse.json({ disciplines });
  }
);
