import { NextResponse } from "next/server";
import {
  createBoq,
  getBoq,
  getBoqByProject,
  updateBoq,
  verifyBoqOwnership,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseBody,
  parseRequest,
  createBoqSchema,
  updateBoqSchema,
} from "@/lib/validations";

/** GET /api/projects/[id]/boq — full BOQ payload (header + sections + items + summary). */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const { id } = params;
    const header = await getBoqByProject(id);
    if (!header) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }
    const full = await getBoq(header.id);
    return NextResponse.json(full);
  }
);

/** POST /api/projects/[id]/boq — create the project's BOQ (one per project). */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const existing = await getBoqByProject(id);
    if (existing) {
      return NextResponse.json(
        { error: "BOQ already exists for this project" },
        { status: 409 }
      );
    }

    const parsed = await parseRequest(req, createBoqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const boq = await createBoq(id, { ...parsed.data, createdBy: user.id });
    return NextResponse.json(boq, { status: 201 });
  }
);

/** PATCH /api/projects/[id]/boq — update BOQ header. Body must include `boqId`. */
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

    const parsed = parseBody(updateBoqSchema, rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateBoq(boqId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }
    return NextResponse.json(updated);
  }
);
