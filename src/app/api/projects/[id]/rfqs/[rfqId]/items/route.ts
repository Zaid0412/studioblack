import { NextResponse } from "next/server";
import { addRfqItems } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { addRfqItemsSchema, parseRequest } from "@/lib/validations";
import { resolveRfqId } from "../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/items — append items to a draft RFQ.
 * Refused once the RFQ leaves draft — scope changes after issue need a
 * new RFQ rather than a stealth edit.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, addRfqItemsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await addRfqItems(resolved.rfqId, parsed.data.items);
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        not_found: [404, "RFQ not found"],
        wrong_status: [
          409,
          "Items can only be added while the RFQ is in draft",
        ],
        no_items: [400, "At least one item is required"],
        bad_items: [400, "One or more BOQ items do not belong to this project"],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json({ count: result.count });
  }
);
