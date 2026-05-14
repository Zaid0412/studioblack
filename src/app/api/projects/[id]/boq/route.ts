import { NextResponse } from "next/server";
import { createBoq, getBoq, getBoqByProject, updateBoq } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createBoqSchema,
  updateBoqSchema,
} from "@/lib/validations";
import { isExternalViewer } from "@/lib/roles";
import { parseBoqRequest } from "./_helpers";

// External viewers get a phase-filtered + scrubbed payload — see getBoq.
export const GET = withAuth(
  { projectAccess: true },
  async (_req, { effectiveRole }, params) => {
    const { id } = params;
    const header = await getBoqByProject(id);
    if (!header) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }
    const full = await getBoq(header.id, {
      viewerIsExternal: isExternalViewer(effectiveRole),
    });
    return NextResponse.json(full);
  }
);

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

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(req, params.id, updateBoqSchema);
    if (!result.ok) return result.response;

    const updated = await updateBoq(result.boqId, result.data);
    if (!updated) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }
    return NextResponse.json(updated);
  }
);
