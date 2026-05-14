import { NextResponse } from "next/server";
import { getRfqsForVendor } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { listRfqsQuerySchema } from "@/lib/validations";
import { ensureVendorPortalEnabled } from "@/lib/vendorPortalGuards";

/** GET /api/vendor-portal/rfqs — RFQs this vendor has been invited to. */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (req, { user, vendorId }) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;

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

    const result = await getRfqsForVendor(vendorId!, parsed.data);
    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);
