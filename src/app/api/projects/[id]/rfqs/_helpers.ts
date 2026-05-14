import { NextResponse } from "next/server";
import { verifyRfqOwnership } from "@/lib/queries";

/**
 * Resolve and verify `rfqId` from route params. `withAuth({ projectAccess })`
 * guards the project but doesn't know about RFQ ownership — a caller could
 * pass an rfqId from a project they don't have access to. Return either the
 * verified id or the 404 response to send back.
 */
export async function resolveRfqId(
  projectId: string,
  rfqId: string | undefined
): Promise<
  { ok: true; rfqId: string } | { ok: false; response: NextResponse }
> {
  if (!rfqId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing rfqId" }, { status: 400 }),
    };
  }
  const owned = await verifyRfqOwnership(rfqId, projectId);
  if (!owned) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "RFQ not found in this project" },
        { status: 404 }
      ),
    };
  }
  return { ok: true, rfqId };
}
