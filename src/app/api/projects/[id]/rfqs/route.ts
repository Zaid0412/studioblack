import { NextResponse } from "next/server";
import { getRfqsByProject } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { listRfqsQuerySchema } from "@/lib/validations";

/** GET /api/projects/[id]/rfqs — paginated RFQ list for the project. */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, _ctx, params) => {
    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listRfqsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }
    const result = await getRfqsByProject(params.id, parsed.data);
    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);
