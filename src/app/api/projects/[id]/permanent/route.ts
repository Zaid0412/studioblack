import { NextResponse } from "next/server";
import { hardDeleteProject } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * DELETE /api/projects/[id]/permanent — irreversibly delete a project and all its
 * data (cascades). Org-owner only; PMs can Archive (soft) but not hard-delete.
 */
export const DELETE = withAuth(
  { allowedRoles: ["pm"], projectAccess: true, fetchOrgRole: true },
  async (_req, { orgRole }, params) => {
    if (orgRole !== "owner") {
      return NextResponse.json(
        {
          error: "Only the organization owner can permanently delete a project",
        },
        { status: 403 }
      );
    }

    const deleted = await hardDeleteProject(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
