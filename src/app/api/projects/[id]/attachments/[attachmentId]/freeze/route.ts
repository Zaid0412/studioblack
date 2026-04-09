import { NextResponse } from "next/server";
import { setAttachmentFreezeStatus } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/freeze — PM can freeze a file. */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`freeze:${user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

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
