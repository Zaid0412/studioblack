import { NextResponse } from "next/server";
import {
  createBoq,
  getBoq,
  getBoqByProject,
  getBoqStatus,
  updateBoq,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createBoqSchema,
  updateBoqSchema,
  BOQ_STATUS_TRANSITIONS,
} from "@/lib/validations";
import { parseBoqRequest } from "./_helpers";

// TODO: this route currently exposes internal pricing (unit_cost,
// material_cost, budget_rate, …) to matched-email clients via
// `hasProjectAccess`. The client approval flow needs SOME of the BOQ to be
// visible, so the answer isn't `blockedRoles: ["client"]`; it's a
// role-aware projection in `getBoq` that strips internal fields when the
// caller is a client. Tracked separately — pre-existing pattern.
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
    // Skip the default editability gate — we enforce it ourselves below so
    // that status-only transitions out of `client_approved` into `locked`
    // remain possible once the status-machine check passes.
    const result = await parseBoqRequest(req, params.id, updateBoqSchema, {
      requireEditable: false,
    });
    if (!result.ok) return result.response;

    const currentStatus = await getBoqStatus(result.boqId, params.id);
    if (currentStatus === null) {
      return NextResponse.json(
        { error: "BOQ not found in this project" },
        { status: 404 }
      );
    }

    const { status: nextStatus, ...otherFields } = result.data;
    const hasOtherFields = Object.values(otherFields).some(
      (v) => v !== undefined
    );

    // Non-status edits require the BOQ to be in an editable state.
    if (
      hasOtherFields &&
      (currentStatus === "locked" || currentStatus === "superseded")
    ) {
      return NextResponse.json(
        {
          error: "This BOQ is locked and can no longer be edited.",
          code: "BOQ_LOCKED",
        },
        { status: 423 }
      );
    }

    // Status transitions must follow the state machine. The
    // internal-review states (`pending_internal_review`,
    // `internally_approved`, `changes_requested`) carry audit columns
    // that this generic PATCH doesn't stamp — force callers through
    // the dedicated endpoints (/submit-for-review, /approve,
    // /request-changes, /cancel-review) so the trail stays uniform.
    const REVIEW_GATE_STATUSES = new Set([
      "pending_internal_review",
      "internally_approved",
      "changes_requested",
    ]);
    if (nextStatus && nextStatus !== currentStatus) {
      if (REVIEW_GATE_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          {
            error: `Use the dedicated endpoint to set status to "${nextStatus}".`,
            code: "USE_REVIEW_ENDPOINT",
          },
          { status: 422 }
        );
      }
      const allowed = BOQ_STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${currentStatus} to ${nextStatus}.`,
            code: "INVALID_STATUS_TRANSITION",
          },
          { status: 422 }
        );
      }
    }

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
