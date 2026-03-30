import { NextResponse } from "next/server";
import {
  getPinCommentById,
  updatePinComment,
  deletePinComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/pins/[pinId] — resolve/unresolve. */
export const PATCH = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`pin:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { pinId } = params;

    const pin = await getPinCommentById(pinId);
    if (!pin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    if (typeof body.resolved !== "boolean") {
      return NextResponse.json(
        { error: "resolved must be a boolean" },
        { status: 400 }
      );
    }

    const updated = await updatePinComment(pinId, body.resolved);
    return NextResponse.json(updated);
  }
);

/** DELETE /api/projects/[id]/attachments/[attachmentId]/pins/[pinId] — delete a pin. */
export const DELETE = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`pin:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { pinId } = params;

    const pin = await getPinCommentById(pinId);
    if (!pin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only the pin author or a PM (org owner/admin) can delete
    const isPm = user.role === "owner" || user.role === "admin";
    if (pin.user_id !== user.id && !isPm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deletePinComment(pinId);
    return NextResponse.json({ ok: true });
  }
);
