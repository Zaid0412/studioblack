import { NextResponse } from "next/server";
import { reorderBoqItems, verifyBoqOwnership } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseBody, reorderItemsSchema } from "@/lib/validations";

/** PATCH /api/projects/[id]/boq/items/reorder — reorder items within a section. */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object" || !("boqId" in raw)) {
      return NextResponse.json({ error: "boqId is required" }, { status: 400 });
    }
    const { boqId, ...rest } = raw as { boqId: string } & Record<
      string,
      unknown
    >;

    const owned = await verifyBoqOwnership(boqId, id);
    if (!owned) {
      return NextResponse.json(
        { error: "BOQ not found in this project" },
        { status: 404 }
      );
    }

    const parsed = parseBody(reorderItemsSchema, rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await reorderBoqItems(boqId, parsed.data.sectionId, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  }
);
