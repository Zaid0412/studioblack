import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { buildCategoryTree, getCategoryTree } from "@/lib/queries";
import { writeCategorySheet } from "@/lib/excel/categoryWriter";

/**
 * GET /api/element-categories/export
 *
 * Streams the org's full taxonomy (Category → Sub-category → Service Area) as an
 * .xlsx. Same layout as the import template, so an export round-trips cleanly
 * back through the importer — mirrors `/api/elements/export`.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const rows = await getCategoryTree(orgId);
    const buffer = await writeCategorySheet(buildCategoryTree(rows));

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `categories-${stamp}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: new Headers({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
        // Reflects live data — must not be cached.
        "Cache-Control": "no-store",
      }),
    });
  }
);
