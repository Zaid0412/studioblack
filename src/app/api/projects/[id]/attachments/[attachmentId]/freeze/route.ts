import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAttachmentById } from "@/lib/queries";
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

    const { id, attachmentId } = params;

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (attachment.frozen_at) {
      return NextResponse.json({ error: "Already frozen" }, { status: 400 });
    }

    const pool = getPool();
    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE attachment SET frozen_at = NOW() WHERE id = $1 RETURNING id, file_name, file_url, frozen_at, review_status`,
      [attachmentId]
    );

    return NextResponse.json(updated);
  }
);
