import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAttachmentById } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/freeze — PM can freeze a file. */
export const PATCH = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, ctx, params) => {
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
      `UPDATE attachment SET frozen_at = NOW() WHERE id = $1 RETURNING *`,
      [attachmentId]
    );

    return NextResponse.json(updated);
  }
);
