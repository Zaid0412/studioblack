import { NextResponse } from "next/server";
import {
  getElementById,
  updateElement,
  softDeleteElement,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateElementSchema } from "@/lib/validations";

/** GET /api/elements/[id] — fetch a single element with attributes + category path. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const element = await getElementById(orgId, params.id);
    if (!element) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json(element);
  }
);

/** PATCH /api/elements/[id] — update an element. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateElementSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await updateElement(orgId, params.id, parsed.data);
      if (!updated) {
        return NextResponse.json(
          { error: "Element not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update element";
      const status = message === "Code already exists" ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);

/** DELETE /api/elements/[id] — soft-delete (archive) an element. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const result = await softDeleteElement(orgId, params.id);
    if (!result.deleted) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
