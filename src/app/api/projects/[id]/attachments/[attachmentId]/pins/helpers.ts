import { NextResponse } from "next/server";
import { getPinCommentById } from "@/lib/queries";

/**
 * Look up a pin comment and verify it belongs to the given attachment.
 * Returns the pin row on success, or a 404 NextResponse on failure.
 */
export async function findPinOrFail(params: Record<string, string>) {
  const pin = await getPinCommentById(params.pinId);
  if (!pin || pin.attachment_id !== params.attachmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return pin;
}
