import { NextResponse } from "next/server";
import {
  deleteBoqSection,
  updateBoqSection,
  verifyBoqSectionOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateBoqSectionSchema } from "@/lib/validations";

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, sectionId } = params;

    const owned = await verifyBoqSectionOwnership(sectionId, id);
    if (!owned) {
      return NextResponse.json(
        { error: "Section not found in this project" },
        { status: 404 }
      );
    }

    const parsed = await parseRequest(req, updateBoqSectionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateBoqSection(sectionId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }
    return NextResponse.json(updated);
  }
);

export const DELETE = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (_req, _ctx, params) => {
    const { id, sectionId } = params;

    const owned = await verifyBoqSectionOwnership(sectionId, id);
    if (!owned) {
      return NextResponse.json(
        { error: "Section not found in this project" },
        { status: 404 }
      );
    }

    const ok = await deleteBoqSection(sectionId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }
);
