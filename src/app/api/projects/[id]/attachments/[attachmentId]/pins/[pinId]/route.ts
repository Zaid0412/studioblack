import { NextResponse } from "next/server";
import {
  getPinCommentById,
  updatePinComment,
  updatePinCommentContent,
  updatePinCommentPosition,
  deletePinComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/**
 * PATCH /api/projects/[id]/attachments/[attachmentId]/pins/[pinId]
 * Supports: { resolved }, { content }, or { x_percent, y_percent, page }
 */
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

    const { attachmentId, pinId } = params;

    const pin = await getPinCommentById(pinId);
    if (!pin || pin.attachment_id !== attachmentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isPm = user.role === "owner" || user.role === "admin";
    const isStaff = isPm || user.role === "member";

    const body = await req.json();

    // --- Resolve/unresolve ---
    if (typeof body.resolved === "boolean") {
      if (pin.user_id !== user.id && !isStaff) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await updatePinComment(pinId, body.resolved);
      return NextResponse.json(updated);
    }

    // --- Edit content ---
    if (typeof body.content === "string") {
      // Only the author can edit content
      if (pin.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const trimmed = body.content.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "content must be a non-empty string" },
          { status: 400 }
        );
      }
      if (trimmed.length > 5000) {
        return NextResponse.json(
          { error: "content must be 5000 characters or less" },
          { status: 400 }
        );
      }
      const updated = await updatePinCommentContent(pinId, trimmed);
      return NextResponse.json(updated);
    }

    // --- Reposition ---
    if (body.x_percent !== undefined) {
      // Only author or PM can reposition
      if (pin.user_id !== user.id && !isPm) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { x_percent, y_percent, page } = body;
      if (
        typeof x_percent !== "number" ||
        x_percent < 0 ||
        x_percent > 100 ||
        typeof y_percent !== "number" ||
        y_percent < 0 ||
        y_percent > 100 ||
        typeof page !== "number" ||
        !Number.isInteger(page) ||
        page < 1
      ) {
        return NextResponse.json(
          { error: "Invalid coordinates" },
          { status: 400 }
        );
      }
      const updated = await updatePinCommentPosition(
        pinId,
        x_percent,
        y_percent,
        page
      );
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "No recognized update fields provided" },
      { status: 400 }
    );
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

    const { attachmentId, pinId } = params;

    const pin = await getPinCommentById(pinId);
    if (!pin || pin.attachment_id !== attachmentId) {
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
