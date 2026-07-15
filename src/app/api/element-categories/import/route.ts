import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { parseCategorySheet } from "@/lib/excel/categoryParser";
import { validateSpreadsheetUpload } from "@/lib/excel/uploadGuard";
import { planCategoryImport } from "@/lib/queries/categoryImport";
import { CATEGORY_IMPORT_MAX_BYTES } from "@/lib/validations";

/**
 * POST /api/element-categories/import
 *
 * Parse an .xlsx/.csv taxonomy and return both the parsed rows and the plan it
 * implies — what would be created, updated, removed, and what is blocking a
 * removal. No DB writes: this is the preview the confirm step then re-derives
 * for itself.
 */
export const POST = withAuth(
  {
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 5, windowMs: 60_000 },
  },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const upload = await validateSpreadsheetUpload(
      req,
      "file",
      CATEGORY_IMPORT_MAX_BYTES,
      { allowCsv: true }
    );
    if (!upload.ok) {
      return NextResponse.json(
        { error: upload.message },
        { status: upload.status }
      );
    }

    try {
      const result = await parseCategorySheet(upload.buffer, upload.format);

      // A sheet with a bad row can't be planned against: the missing rows would
      // read as deletions and the preview would tell the user we're about to
      // remove half their taxonomy. Make them fix the rows first.
      const valid = result.rows.filter((r) => r.parsed);
      const plan =
        valid.length === result.rows.length && valid.length > 0
          ? await planCategoryImport(
              orgId,
              valid.map((r) => r.parsed!.path)
            )
          : null;

      return NextResponse.json({ ...result, plan });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read spreadsheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
