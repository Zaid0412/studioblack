import { NextResponse } from "next/server";
import { removeRfqItem, updateRfqItemAttachments } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  updateRfqItemAttachmentsSchema,
} from "@/lib/validations";
import { resolveRfqId } from "../../../_helpers";

/**
 * DELETE /api/projects/[id]/rfqs/[rfqId]/items/[itemId] — remove one item
 * from a draft RFQ. Same status rules as add (draft only).
 */
export const DELETE = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    if (!params.itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const result = await removeRfqItem(resolved.rfqId, params.itemId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Items can only be removed while the RFQ is in draft" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }
);

/**
 * PATCH /api/projects/[id]/rfqs/[rfqId]/items/[itemId] — replace the line's
 * reference attachments (PRD §11). Allowed while the RFQ is live (not terminal).
 */
export const PATCH = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    if (!params.itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateRfqItemAttachmentsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await updateRfqItemAttachments(
      resolved.rfqId,
      params.itemId,
      parsed.data.attachments
    );
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Attachments can't be edited on a closed RFQ" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }
);
