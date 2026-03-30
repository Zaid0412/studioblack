import { NextResponse } from "next/server";
import { getPinComments, createPinComment, getAttachmentById } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/** GET /api/projects/[id]/attachments/[attachmentId]/pins — list pin comments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { attachmentId } = params;

    const pins = await getPinComments(attachmentId);
    return NextResponse.json(pins);
  }
);

/** POST /api/projects/[id]/attachments/[attachmentId]/pins — create a pin comment. */
export const POST = withAuth(
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

    const { id, attachmentId } = params;

    // Verify attachment belongs to this project
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { x_percent, y_percent, page, content } = body;

    // Validate x_percent
    if (typeof x_percent !== "number" || x_percent < 0 || x_percent > 100) {
      return NextResponse.json(
        { error: "x_percent must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    // Validate y_percent
    if (typeof y_percent !== "number" || y_percent < 0 || y_percent > 100) {
      return NextResponse.json(
        { error: "y_percent must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    // Validate page
    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { error: "page must be a positive integer" },
        { status: 400 }
      );
    }

    // Validate content
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content must be a non-empty string" },
        { status: 400 }
      );
    }

    const pin = await createPinComment({
      attachmentId,
      userId: user.id,
      xPercent: x_percent,
      yPercent: y_percent,
      page,
      content: content.trim(),
    });

    return NextResponse.json(pin, { status: 201 });
  }
);
