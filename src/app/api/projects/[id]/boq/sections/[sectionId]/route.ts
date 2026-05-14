import { NextResponse } from "next/server";
import {
  deleteBoqSection,
  updateBoqSection,
  verifyBoqSectionOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateBoqSectionSchema } from "@/lib/validations";
import { notFoundResponse } from "../../_helpers";

const notFound = () => notFoundResponse("Section not found in this project");

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, sectionId } = params;

    if (!(await verifyBoqSectionOwnership(sectionId, id))) return notFound();

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
  async (req, _ctx, params) => {
    const { id, sectionId } = params;

    if (!(await verifyBoqSectionOwnership(sectionId, id))) return notFound();

    // `?cascade=true` deletes the section's items in the same TX. Defaults
    // to false (items reflow to Unassigned via ON DELETE SET NULL).
    const cascade = req.nextUrl.searchParams.get("cascade") === "true";

    const ok = await deleteBoqSection(sectionId, cascade);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  }
);
