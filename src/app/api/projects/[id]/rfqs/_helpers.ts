import { NextResponse } from "next/server";
import { verifyRfqOwnership } from "@/lib/queries";
import { sendRfqIssuedEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { env } from "@/env";
import type { RfqContactForEmail } from "@/lib/queries/rfqs";

export interface RfqIssueContext {
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  projectName: string;
  responseDeadline: string | null;
}

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

/**
 * Email fan-out fired after `issueRfq` commits. Per-recipient failures are
 * logged but never re-thrown — partial SMTP failure is expected for invalid
 * vendor addresses and must not roll back the RFQ. Returns the count of
 * attempted sends so the route can include it in the audit metadata.
 */
export async function notifyRfqIssued(
  contacts: readonly RfqContactForEmail[],
  ctx: RfqIssueContext
): Promise<number> {
  const appUrl = env().NEXT_PUBLIC_APP_URL ?? "";
  const deepLink = `${appUrl}/vendor-portal/rfqs/${ctx.rfqId}`;

  // Sequential — keeps SMTP load predictable. If we later need parallelism,
  // switch to Promise.allSettled with a concurrency limit.
  for (const c of contacts) {
    try {
      await sendRfqIssuedEmail(c.contactEmail, {
        contactName: c.contactName,
        vendorName: c.vendorName,
        projectName: ctx.projectName,
        rfqNumber: ctx.rfqNumber,
        rfqTitle: ctx.rfqTitle,
        responseDeadline: ctx.responseDeadline,
        deepLink,
      });
    } catch (err) {
      logger.warn("RFQ issue email failed", {
        rfqId: ctx.rfqId,
        contactId: c.contactId,
        err: String(err),
      });
    }
  }
  return contacts.length;
}
