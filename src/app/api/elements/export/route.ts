import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getElementsForExport, getCategoryTree } from "@/lib/queries";
import { writeElementSheet } from "@/lib/excel/elementWriter";
import { listElementsQuerySchema } from "@/lib/validations";

/**
 * GET /api/elements/export
 * Streams the currently-filtered element library as an .xlsx file. Column
 * layout mirrors the import template so the file round-trips cleanly.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const { searchParams } = req.nextUrl;
    const raw: Record<string, unknown> = Object.fromEntries(searchParams);
    const tagValues = searchParams.getAll("tags");
    if (tagValues.length > 0) raw.tags = tagValues;

    // Strip pagination from both input and parsed data — export hits its
    // own cap (`ELEMENT_EXPORT_LIMIT`), never the per-page user limit.
    delete raw.page;
    delete raw.limit;

    const parsed = listElementsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    const { page: _p, limit: _l, ...filters } = parsed.data;
    void _p;
    void _l;
    const [{ rows, total, truncated }, categories] = await Promise.all([
      getElementsForExport(orgId, filters),
      getCategoryTree(orgId),
    ]);

    const buffer = await writeElementSheet(rows, categories);

    const stamp = new Date().toISOString().slice(0, 10);
    const headers = new Headers({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="elements-${stamp}.xlsx"`,
      "X-Element-Count": String(rows.length),
      "X-Element-Total": String(total),
    });
    if (truncated) headers.set("X-Export-Truncated", "true");

    return new NextResponse(buffer as unknown as BodyInit, { headers });
  }
);
