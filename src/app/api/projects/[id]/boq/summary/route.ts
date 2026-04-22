import { NextResponse } from "next/server";
import { getBoqByProject, getBoqSummary } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/boq/summary — totals, section breakdown, flag counts. */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const { id } = params;
    const header = await getBoqByProject(id);
    if (!header) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }
    const summary = await getBoqSummary(header.id);
    return NextResponse.json(summary);
  }
);
