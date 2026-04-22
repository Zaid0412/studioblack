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

    const parsed = listElementsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    // Export uses its own cap (ELEMENT_EXPORT_LIMIT), never the per-page
    // user limit — strip pagination from the parsed filter bag.
    const { page: _page, limit: _limit, ...filters } = parsed.data;
    void _page;
    void _limit;
    const [{ rows, total, truncated }, categories] = await Promise.all([
      getElementsForExport(orgId, filters),
      getCategoryTree(orgId),
    ]);

    const buffer = await writeElementSheet(rows, categories);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = buildExportFilename(stamp, filters);
    const headers = new Headers({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(filename),
      "X-Element-Count": String(rows.length),
      "X-Element-Total": String(total),
    });
    if (truncated) headers.set("X-Export-Truncated", "true");

    return new NextResponse(new Uint8Array(buffer), { headers });
  }
);

/**
 * RFC 5987 Content-Disposition header: plain ASCII `filename=` fallback plus
 * percent-encoded UTF-8 `filename*=` for non-ASCII names (Turkish etc.). All
 * major browsers prefer the `*` form when both are present.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Compose an export filename that hints at the active filter set so same-day
 * filtered exports don't collide on disk.
 */
function buildExportFilename(
  stamp: string,
  filters: Record<string, unknown>
): string {
  const parts: string[] = ["elements", stamp];
  if (typeof filters.search === "string" && filters.search.trim()) {
    parts.push(`search-${slug(filters.search)}`);
  }
  if (typeof filters.unit === "string" && filters.unit) {
    parts.push(`unit-${slug(filters.unit)}`);
  }
  if (filters.categoryId) parts.push("filtered");
  const tags = filters.tags;
  if (Array.isArray(tags) && tags.length > 0) {
    parts.push(`tags-${tags.length}`);
  }
  if (filters.isActive === false) parts.push("archived");
  return `${parts.join("-")}.xlsx`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
