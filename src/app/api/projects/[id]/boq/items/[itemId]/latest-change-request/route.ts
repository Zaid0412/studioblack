import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getLatestBoqItemChangeRequest } from "@/lib/queries";

/**
 * GET /api/projects/[id]/boq/items/[itemId]/latest-change-request
 *
 * Returns the most recent change-request audit event for this item, or
 * `null` if it's never been kicked back. Used by the BOQ item drawer to
 * render a "Changes requested by …" banner when the item is currently in
 * `internal_changes_requested` / `client_changes_requested`.
 *
 * Open to every project member; the comment doesn't expose any cost data.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const event = await getLatestBoqItemChangeRequest(params.itemId);
    return NextResponse.json(event);
  }
);
