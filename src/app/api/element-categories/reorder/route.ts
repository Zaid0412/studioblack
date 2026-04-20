import { NextResponse } from "next/server";
import { reorderCategories } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, reorderCategoriesSchema } from "@/lib/validations";

/** PATCH /api/element-categories/reorder — reorder categories within a parent. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, reorderCategoriesSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await reorderCategories(
      orgId,
      parsed.data.parentId,
      parsed.data.orderedIds
    );
    return NextResponse.json({ ok: true });
  }
);
