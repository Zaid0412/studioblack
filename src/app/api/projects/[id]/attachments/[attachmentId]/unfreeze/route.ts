import { NextResponse } from "next/server";
import { setAttachmentFreezeStatus } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/unfreeze — PM can unfreeze. */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`unfreeze:${user.id}`, {
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
      false
    );

    if (error === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);
