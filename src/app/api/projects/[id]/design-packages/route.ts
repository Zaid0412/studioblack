import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDesignPackages } from "@/lib/queries";

/**
 * GET /api/projects/[id]/design-packages
 *
 * The project's design packages (Concept, Schematic, …), ordered for display.
 * Document Control module, PR-1.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const packages = await getDesignPackages(params.id);
    return NextResponse.json({ packages });
  }
);
