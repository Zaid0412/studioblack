import { NextResponse } from "next/server";
import { getVendorServiceAreas } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/vendors/service-areas — distinct service areas across the org's
 * vendors. Powers the service-area filter dropdown on the vendors page.
 */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ serviceAreas: [] });
    }

    const serviceAreas = await getVendorServiceAreas(orgId);
    return NextResponse.json({ serviceAreas });
  }
);
