import { NextResponse } from "next/server";
import { bulkCreateCategoriesFromTemplates } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, bulkCreateCategoriesSchema } from "@/lib/validations";

/**
 * POST /api/element-categories/bulk
 *
 * Idempotent bulk create — skips top-level + child entries whose name already
 * exists for the org. Used by the "Use a starter set" flow to seed a starter
 * taxonomy without forcing the user to build the tree node-by-node.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, bulkCreateCategoriesSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const result = await bulkCreateCategoriesFromTemplates(
        orgId,
        parsed.data.categories
      );
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create categories";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
