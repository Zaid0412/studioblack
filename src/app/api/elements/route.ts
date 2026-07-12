import { NextResponse } from "next/server";
import { getElements, createElement } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createElementSchema,
  listElementsQuerySchema,
} from "@/lib/validations";

/** GET /api/elements — list elements with filters + pagination. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const { searchParams } = req.nextUrl;
    const raw: Record<string, unknown> = Object.fromEntries(searchParams);
    const tagValues = searchParams.getAll("tags");
    if (tagValues.length > 0) {
      raw.tags = tagValues;
    }

    const parsed = listElementsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    const { rows, total } = await getElements(orgId, parsed.data);
    return NextResponse.json({
      rows,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);

/** POST /api/elements — create a new element. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, createElementSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const element = await createElement(orgId, user.id, parsed.data);
      return NextResponse.json(element, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create element";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
