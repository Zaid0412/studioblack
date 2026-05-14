import { NextResponse } from "next/server";
import { getRfqDetail } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../_helpers";

/** GET /api/projects/[id]/rfqs/[rfqId] — full RFQ detail (header + items + invited vendors). */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const detail = await getRfqDetail(resolved.rfqId);
    if (!detail) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
);
