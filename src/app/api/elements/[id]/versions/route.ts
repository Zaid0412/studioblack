import { NextResponse } from "next/server";
import { getVersionHistory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/elements/[id]/versions — all versions in the element's version_group, newest first. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const versions = await getVersionHistory(orgId, params.id);
    if (versions.length === 0) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json({ versions });
  }
);
