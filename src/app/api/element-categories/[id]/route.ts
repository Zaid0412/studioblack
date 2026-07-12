import { NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateElementCategorySchema } from "@/lib/validations";

/** PATCH /api/element-categories/[id] — update a category. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateElementCategorySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const body = parsed.data;
    const fields: Record<string, unknown> = {
      name: body.name,
      code_prefix: body.codePrefix,
      sort_order: body.sortOrder,
      icon: body.icon,
      color: body.color,
      is_active: body.isActive,
    };

    try {
      const updated = await updateCategory(params.id, orgId, fields);
      if (!updated) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update category";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);

/** DELETE /api/element-categories/[id] — delete a category. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const result = await deleteCategory(params.id, orgId);
    if (!result.deleted) {
      const status = result.error === "Category not found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  }
);
