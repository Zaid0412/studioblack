import { NextResponse } from "next/server";
import {
  updatePinComment,
  updatePinCommentContent,
  updatePinCommentPosition,
  deletePinComment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updatePinSchema } from "@/lib/validations";
import { findPinOrFail } from "../helpers";

/**
 * PATCH /api/projects/[id]/attachments/[attachmentId]/pins/[pinId]
 * Supports: { resolved }, { content }, or { x_percent, y_percent, page }
 */
export const PATCH = withAuth(
  { projectAccess: true, rateLimit: { limit: 30, windowMs: 60_000 } },
  async (req, { user }, params) => {
    const { attachmentId, pinId } = params;

    const pinOrError = await findPinOrFail(pinId, attachmentId);
    if (pinOrError instanceof NextResponse) return pinOrError;
    const pin = pinOrError;

    const isPm = user.role === "pm";
    const isStaff = isPm; // all non-client authenticated users are staff

    const parsed = await parseRequest(req, updatePinSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // --- Resolve/unresolve ---
    if (typeof parsed.data.resolved === "boolean") {
      if (pin.user_id !== user.id && !isStaff) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await updatePinComment(pinId, parsed.data.resolved);
      return NextResponse.json(updated);
    }

    // --- Edit content ---
    if (parsed.data.content !== undefined) {
      // Only the author can edit content
      if (pin.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await updatePinCommentContent(pinId, parsed.data.content);
      return NextResponse.json(updated);
    }

    // --- Reposition ---
    if (parsed.data.x_percent !== undefined) {
      // Only author or PM can reposition
      if (pin.user_id !== user.id && !isPm) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { x_percent, y_percent, page } = parsed.data;
      if (
        x_percent === undefined ||
        y_percent === undefined ||
        page === undefined
      ) {
        return NextResponse.json(
          { error: "x_percent, y_percent, and page must all be provided" },
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
  { projectAccess: true, rateLimit: { limit: 30, windowMs: 60_000 } },
  async (req, { user }, params) => {
    const { attachmentId, pinId } = params;

    const pinOrError = await findPinOrFail(pinId, attachmentId);
    if (pinOrError instanceof NextResponse) return pinOrError;
    const pin = pinOrError;

    // Only the pin author or a PM can delete
    const isPm = user.role === "pm";
    if (pin.user_id !== user.id && !isPm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deletePinComment(pinId);
    return NextResponse.json({ ok: true });
  }
);
