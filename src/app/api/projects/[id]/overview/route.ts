import { NextResponse } from "next/server";
import { getProjectOverview } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/projects/[id]/overview — aggregated dashboard for the project home
 * (KPIs, design-status donut, cost/progress chart, recent activity). Scoped to
 * the viewer's effective role: clients get the sent-to-client slice, the
 * client-scrubbed BOQ total, and no procurement. Project details + team come
 * from `/api/projects/[id]`, so they're not duplicated here.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, { effectiveRole }, params) => {
    const overview = await getProjectOverview(params.id, effectiveRole);
    return NextResponse.json(overview);
  }
);
