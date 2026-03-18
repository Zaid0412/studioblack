import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getAttachmentById,
  getAttachmentVersionHistory,
  hasProjectAccess,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

/** GET /api/projects/[id]/attachments/[attachmentId] — get single attachment with version history. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachment = await getAttachmentById(attachmentId, id);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Include version history if this file has versions
  let versions: unknown[] = [];
  if (attachment.version_group) {
    versions = await getAttachmentVersionHistory(attachment.version_group);
  }

  return NextResponse.json({ ...attachment, versions });
}
