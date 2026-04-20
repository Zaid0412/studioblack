import { NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateElementCategorySchema } from "@/lib/validations";

/** PATCH /api/element-categories/[id] — update a category. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, _ctx, params) => {
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

    const updated = await updateCategory(params.id, fields);
    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }
);

/** DELETE /api/element-categories/[id] — delete a category. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, _ctx, params) => {
    const result = await deleteCategory(params.id);
    if (!result.deleted) {
      const status = result.error === "Category not found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  }
);
