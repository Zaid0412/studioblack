import { NextResponse } from "next/server";
import { getAttachmentVersionHistory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/versions/[versionGroup] — get all versions by group. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, { effectiveRole }, params) => {
    const { id, versionGroup } = params;

    const versions = await getAttachmentVersionHistory(
      versionGroup,
      id,
      effectiveRole === "client"
    );
    if (versions.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(versions);
  }
);
