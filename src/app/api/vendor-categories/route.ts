import { NextResponse } from "next/server";
import {
  getVendorCategoryTree,
  buildVendorCategoryTree,
  createVendorCategory,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createVendorCategorySchema } from "@/lib/validations";

/** GET /api/vendor-categories — fetch the full vendor-category tree for the org. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ tree: [] });
    }
    const rows = await getVendorCategoryTree(orgId);
    const tree = buildVendorCategoryTree(rows);
    return NextResponse.json({ tree });
  }
);

/** POST /api/vendor-categories — create a new vendor category. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, createVendorCategorySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const category = await createVendorCategory(orgId, parsed.data);
      return NextResponse.json(category, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create category";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
