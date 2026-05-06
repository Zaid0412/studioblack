import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPendingReviews } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/dashboard/pending-reviews — org-wide attachments awaiting design
 * review. Powers the popover anchored to the dashboard's "Pending Reviews"
 * stat card. Clients are blocked — this is an internal queue.
 */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { session }) => {
    let orgId = session.session.activeOrganizationId;
    if (!orgId) {
      const orgs = await auth.api.listOrganizations({
        headers: await headers(),
      });
      if (orgs && orgs.length > 0) orgId = orgs[0].id;
    }
    if (!orgId) return NextResponse.json({ reviews: [] });

    const reviews = await getPendingReviews(orgId);
    return NextResponse.json({ reviews });
  }
);
