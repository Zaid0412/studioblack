import { NextResponse } from "next/server";
import { getProjectMembers } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/members — list project members for @mention autocomplete. */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const { id } = params;
    const members = await getProjectMembers(id);
    return NextResponse.json(members);
  }
);
