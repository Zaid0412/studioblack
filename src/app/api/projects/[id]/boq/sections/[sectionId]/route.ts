import { NextResponse } from "next/server";
import { deleteBoqSection, updateBoqSection } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateBoqSectionSchema } from "@/lib/validations";
import { assertSectionEditable } from "../../_helpers";

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id, sectionId } = params;

    const gate = await assertSectionEditable(sectionId, id);
    if (gate) return gate;

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

    const gate = await assertSectionEditable(sectionId, id);
    if (gate) return gate;

    // `?cascade=true` deletes the section's items in the same TX. Defaults
    // to false (items reflow to Unassigned via ON DELETE SET NULL).
    const cascade = req.nextUrl.searchParams.get("cascade") === "true";

    const ok = await deleteBoqSection(sectionId, cascade);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }
);
