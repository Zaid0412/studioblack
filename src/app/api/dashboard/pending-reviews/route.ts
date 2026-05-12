import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPendingReviews, getPendingBoqReviews } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/dashboard/pending-reviews — org-wide queue of items awaiting
 * internal review: design files (attachments) + BOQs in
 * `pending_internal_review`. Powers the popover anchored to the
 * dashboard's "Pending Reviews" stat card. Clients are blocked — this
 * is an internal queue.
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
    if (!orgId) return NextResponse.json({ files: [], boqs: [] });

    const [files, boqs] = await Promise.all([
      getPendingReviews(orgId),
      getPendingBoqReviews(orgId),
    ]);
    return NextResponse.json({ files, boqs });
  }
);
