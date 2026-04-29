import { NextResponse } from "next/server";
import {
  getVendorById,
  updateVendor,
  softDeleteVendor,
  hardDeleteVendor,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateVendorSchema } from "@/lib/validations";

/** GET /api/vendors/[id] — vendor with contacts and trades. No bank details. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const vendor = await getVendorById(orgId, params.id);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json(vendor);
  }
);

/** PATCH /api/vendors/[id] — update non-financial fields. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateVendorSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const updated = await updateVendor(orgId, params.id, parsed.data);
      if (!updated) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update vendor";
      const status = /duplicate/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);

/**
 * DELETE /api/vendors/[id] — soft delete by default; `?hard=true` permanently
 * removes the row (and CASCADE-removes contacts/trades). PM only.
 */
export const DELETE = withAuth(
  { allowedRoles: ["pm"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const hard = req.nextUrl.searchParams.get("hard") === "true";
    const ok = hard
      ? await hardDeleteVendor(orgId, params.id)
      : await softDeleteVendor(orgId, params.id);

    if (!ok) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, mode: hard ? "hard" : "soft" });
  }
);
