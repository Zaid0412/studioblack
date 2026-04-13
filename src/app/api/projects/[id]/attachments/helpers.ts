import { NextResponse } from "next/server";
import { getAttachmentById } from "@/lib/queries";

/**
 * Look up an attachment and verify it belongs to the given project.
 * Returns the attachment row on success, or a 404 NextResponse on failure.
 */
export async function findAttachmentOrFail(
  attachmentId: string,
  projectId: string
) {
  const attachment = await getAttachmentById(attachmentId, projectId);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return attachment;
}
