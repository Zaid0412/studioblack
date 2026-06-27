import { NextResponse } from "next/server";
import { updateVendorCategory, deleteVendorCategory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateVendorCategorySchema } from "@/lib/validations";

/** PATCH /api/vendor-categories/[id] — update a vendor category. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateVendorCategorySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const body = parsed.data;
    const fields: Record<string, unknown> = {
      name: body.name,
      code: body.code,
      sort_order: body.sortOrder,
      icon: body.icon,
      color: body.color,
      is_active: body.isActive,
    };

    const updated = await updateVendorCategory(params.id, orgId, fields);
    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  }
);

/** DELETE /api/vendor-categories/[id] — delete a vendor category. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const result = await deleteVendorCategory(params.id, orgId);
    if (!result.deleted) {
      const status = result.error === "Category not found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  }
);
