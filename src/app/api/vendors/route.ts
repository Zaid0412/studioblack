import { NextResponse } from "next/server";
import { getVendors, createVendor } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createVendorSchema,
  listVendorsQuerySchema,
} from "@/lib/validations";

/** GET /api/vendors — list vendors with filters + pagination. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listVendorsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }

    const { rows, total } = await getVendors(orgId, parsed.data);
    return NextResponse.json({
      rows,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);

/** POST /api/vendors — create a vendor + nested contacts/trades. PM only. */
export const POST = withAuth(
  { allowedRoles: ["pm"] },
  async (req, { orgId, user }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, createVendorSchema);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error, field: parsed.field },
        { status: 400 }
      );
    }

    try {
      const created = await createVendor(orgId, user.id, parsed.data);
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create vendor";
      // A duplicate vendor code is a conflict tied to the `vendorCode` field.
      const conflict = /already exists/i.test(message);
      return NextResponse.json(
        { error: message, ...(conflict ? { field: "vendorCode" } : {}) },
        { status: conflict ? 409 : 400 }
      );
    }
  }
);
