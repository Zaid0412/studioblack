import { NextResponse } from "next/server";
import {
  getCategoryTree,
  buildCategoryTree,
  createCategory,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createElementCategorySchema } from "@/lib/validations";

/** GET /api/element-categories — fetch the full category tree for the org. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ tree: [] });
    }
    const rows = await getCategoryTree(orgId);
    const tree = buildCategoryTree(rows);
    return NextResponse.json({ tree });
  }
);

/** POST /api/element-categories — create a new category. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, createElementCategorySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const category = await createCategory(orgId, parsed.data);
      return NextResponse.json(category, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create category";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
