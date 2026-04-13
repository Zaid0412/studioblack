import { NextResponse } from "next/server";
import { getPinCommentById } from "@/lib/queries";

/**
 * Look up a pin comment and verify it belongs to the given attachment.
 * Returns the pin row on success, or a 404 NextResponse on failure.
 */
export async function findPinOrFail(pinId: string, attachmentId: string) {
  const pin = await getPinCommentById(pinId);
  if (!pin || pin.attachment_id !== attachmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return pin;
}
