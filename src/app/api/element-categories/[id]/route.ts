import { NextResponse } from "next/server";
import { getCategoryById, updateCategory, deleteCategory } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateElementCategorySchema } from "@/lib/validations";

/** PATCH /api/element-categories/[id] — update a category. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, _ctx, params) => {
    const category = await getCategoryById(params.id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const parsed = await parseRequest(req, updateElementCategorySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateCategory(params.id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    return NextResponse.json(updated);
  }
);

/** DELETE /api/element-categories/[id] — delete a category. */
export const DELETE = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, _ctx, params) => {
    const category = await getCategoryById(params.id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const result = await deleteCategory(params.id);
    if (!result.deleted) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  }
);
