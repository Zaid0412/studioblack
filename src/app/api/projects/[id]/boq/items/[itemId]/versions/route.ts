import { NextResponse } from "next/server";
import { getBoqItemVersions, verifyBoqItemOwnership } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import type { BoqItemVersion } from "@/types";

/**
 * GET /api/projects/[id]/boq/items/[itemId]/versions
 *
 * Immutable material-change history (qty/spec/cost/dimensions) for a BOQ item,
 * newest first (RFQ-3a). Rendered by the Change history block on the Activity
 * tab in `BoqItemDrawer`. Studio-only — the client doesn't see internal churn.
 */
export const GET = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (_req, _ctx, params) => {
    const { id: projectId, itemId } = params;

    if (!(await verifyBoqItemOwnership(itemId, projectId))) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }

    const versions = await getBoqItemVersions(itemId);
    return NextResponse.json({ versions: versions satisfies BoqItemVersion[] });
  }
);
