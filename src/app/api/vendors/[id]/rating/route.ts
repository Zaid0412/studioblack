import { NextResponse } from "next/server";
import { updateVendorRating } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, vendorRatingSchema } from "@/lib/validations";

/** PATCH /api/vendors/[id]/rating — set the manual rating. PM + Architect. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, vendorRatingSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await updateVendorRating(
      orgId,
      params.id,
      parsed.data.rating
    );
    if (!updated) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }
);
