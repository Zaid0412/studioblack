import { NextResponse } from "next/server";
import { getAttachmentById, isAttachmentIssued } from "@/lib/queries";

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

/**
 * Guard: block mutating a version that has been officially issued as a drawing
 * revision (Design → Document Control, PR-3). Issued versions are read-only —
 * new markup and deletions go on the next version, not the frozen one. This is
 * the revision-level counterpart to the whole-drawing `frozen_at` freeze.
 * Returns a 409 NextResponse when issued, or null to proceed.
 */
export async function failIfIssued(attachmentId: string) {
  if (await isAttachmentIssued(attachmentId)) {
    return NextResponse.json(
      { error: "This version has been issued and is read-only" },
      { status: 409 }
    );
  }
  return null;
}
