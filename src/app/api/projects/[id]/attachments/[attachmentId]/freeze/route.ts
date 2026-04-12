import { NextResponse } from "next/server";
import { setAttachmentFreezeStatus } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/freeze — PM can freeze a file. */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true, rateLimit: { limit: 10, windowMs: 60_000 } },
  async (_req, _ctx, params) => {
    const { error, data } = await setAttachmentFreezeStatus(
      params.attachmentId,
      params.id,
      true
    );

    if (error === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error === "already_frozen") {
      return NextResponse.json({ error: "Already frozen" }, { status: 400 });
    }

    return NextResponse.json(data);
  }
);
