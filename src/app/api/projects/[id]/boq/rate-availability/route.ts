import { NextResponse } from "next/server";
import { getBestRateForElements } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, boqRateAvailabilitySchema } from "@/lib/validations";

/**
 * POST /api/projects/[id]/boq/rate-availability — batch check which of the
 * given elements have an active matching rate contract. Returns the best
 * (most-specific, cheapest) rate per element, keyed by element id, or null.
 * Powers the "rate contract available" hints on the RFQ-create picker.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"], projectAccess: true },
  async (req, { orgId }) => {
    if (!orgId) return NextResponse.json({ availability: {} });

    const parsed = await parseRequest(req, boqRateAvailabilitySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const availability = await getBestRateForElements(
      orgId,
      parsed.data.elementIds
    );
    return NextResponse.json({ availability });
  }
);
