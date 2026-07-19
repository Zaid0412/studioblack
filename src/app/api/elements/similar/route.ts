import { NextResponse } from "next/server";
import { findSimilarElements } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { similarElementsQuerySchema } from "@/lib/validations";

/**
 * GET /api/elements/similar?categoryId=&q=&tags= — likely-duplicate elements for
 * a manual BOQ line (same Service Area + description/keyword match). Feeds the
 * create sheet's inline "Similar elements" suggestions so the user can reuse an
 * element instead of the server auto-creating one.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) return NextResponse.json({ rows: [] });

    const { searchParams } = req.nextUrl;
    const raw: Record<string, unknown> = {
      categoryId: searchParams.get("categoryId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    };
    const tagValues = searchParams.getAll("tags");
    if (tagValues.length > 0) raw.tags = tagValues;

    const parsed = similarElementsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    const rows = await findSimilarElements(orgId, {
      categoryId: parsed.data.categoryId,
      description: parsed.data.q,
      tags: parsed.data.tags,
    });
    return NextResponse.json({ rows });
  }
);
