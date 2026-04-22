import { NextResponse } from "next/server";
import { addElementToBoq, verifyBoqOwnership } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseBody, addElementToBoqSchema } from "@/lib/validations";

/** POST /api/projects/[id]/boq/items/from-element — add element library entry as a BOQ item. */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    const { id } = params;

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

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

    const parsed = parseBody(addElementToBoqSchema, rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const item = await addElementToBoq(boqId, orgId, parsed.data);
    if (!item) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json(item, { status: 201 });
  }
);
