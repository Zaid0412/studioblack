import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { buildCategoryTree, getCategoryTree } from "@/lib/queries";
import { writeCategorySheet } from "@/lib/excel/categoryWriter";

/**
 * GET /api/element-categories/import/template
 *
 * Streams the org's *current* taxonomy as an .xlsx, in the exact shape the
 * importer accepts. Not a blank template on purpose: an import is a diff, so the
 * safest starting point is what you already have — edit a cell, upload it back,
 * and the only change is the one you made. A blank template would read as
 * "delete everything", which is precisely the mistake we don't want to make easy.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const rows = await getCategoryTree(orgId);
    const buffer = await writeCategorySheet(buildCategoryTree(rows));

    return new NextResponse(new Uint8Array(buffer), {
      headers: new Headers({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=\"categories.xlsx\"; filename*=UTF-8''categories.xlsx",
        // Reflects live data — must not be cached.
        "Cache-Control": "no-store",
      }),
    });
  }
);
