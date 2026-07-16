import { NextResponse } from "next/server";
import { updateDivision, deleteDivision } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateDivisionSchema } from "@/lib/validations";

/** PATCH /api/divisions/[id] — rename / enable / disable / set-default a division. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateDivisionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const body = parsed.data;
    const fields: Record<string, unknown> = {
      code: body.code,
      name: body.name,
      enabled: body.enabled,
      is_default: body.isDefault,
      sort_order: body.sortOrder,
    };

    try {
      const updated = await updateDivision(params.id, orgId, fields);
      if (!updated) {
        return NextResponse.json(
          { error: "Division not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update division";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);

/** DELETE /api/divisions/[id] — remove a division (blocked while in use). */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const result = await deleteDivision(params.id, orgId);
    if (!result.deleted) {
      const status = result.error === "Division not found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  }
);
