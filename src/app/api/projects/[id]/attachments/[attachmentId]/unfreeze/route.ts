import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAttachmentById } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/unfreeze — PM can unfreeze. */
export const PATCH = withAuth(
  { allowedRoles: ["owner", "admin"], projectAccess: true },
  async (req, ctx, params) => {
    const { id, attachmentId } = params;

    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pool = getPool();
    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE attachment SET frozen_at = NULL WHERE id = $1 RETURNING *`,
      [attachmentId]
    );

    return NextResponse.json(updated);
  }
);
