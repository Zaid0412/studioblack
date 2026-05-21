import { sendQuoteAwardedEmail, sendQuoteReceivedEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { env } from "@/env";
import type { QuoteStudioRecipient } from "@/lib/queries/quotes";

interface QuoteReceivedContext {
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  projectId: string;
  projectName: string;
  vendorName: string;
  isRevision: boolean;
  isLate: boolean;
}

/**
 * Email studio-side recipients (RFQ creator + org owners/admins) that a
 * quote was just submitted or revised. Sequential to keep SMTP load
 * predictable; per-recipient failures are logged but never re-thrown
 * (mirrors the F9 `notifyRfqIssued` shape).
 */
export async function notifyQuoteReceived(
  recipients: readonly QuoteStudioRecipient[],
  ctx: QuoteReceivedContext
): Promise<number> {
  const appUrl = env().NEXT_PUBLIC_APP_URL ?? "";
  const deepLink = `${appUrl}/projects/${ctx.projectId}/boq/rfq/${ctx.rfqId}`;

  for (const r of recipients) {
    try {
      await sendQuoteReceivedEmail(r.email, {
        recipientName: r.name,
        vendorName: ctx.vendorName,
        projectName: ctx.projectName,
        rfqNumber: ctx.rfqNumber,
        rfqTitle: ctx.rfqTitle,
        isRevision: ctx.isRevision,
        isLate: ctx.isLate,
        deepLink,
      });
    } catch (err) {
      logger.warn("Quote received email failed", {
        rfqId: ctx.rfqId,
        userId: r.userId,
        err: String(err),
      });
    }
  }
  return recipients.length;
}

interface QuoteAwardedContext {
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  projectName: string;
}

/**
 * Email the winning vendor's `receives_rfq=true` contacts that their
 * quote has been awarded. Deep link goes to the vendor portal RFQ
 * detail. Per-send failures logged, never re-thrown.
 */
export async function notifyQuoteAwarded(
  contacts: ReadonlyArray<{
    contactId: string;
    contactName: string;
    contactEmail: string;
    vendorName: string;
  }>,
  ctx: QuoteAwardedContext
): Promise<number> {
  const appUrl = env().NEXT_PUBLIC_APP_URL ?? "";
  const deepLink = `${appUrl}/vendor-portal/rfqs/${ctx.rfqId}`;

  for (const c of contacts) {
    try {
      await sendQuoteAwardedEmail(c.contactEmail, {
        contactName: c.contactName,
        vendorName: c.vendorName,
        projectName: ctx.projectName,
        rfqNumber: ctx.rfqNumber,
        rfqTitle: ctx.rfqTitle,
        deepLink,
      });
    } catch (err) {
      logger.warn("Quote awarded email failed", {
        rfqId: ctx.rfqId,
        contactId: c.contactId,
        err: String(err),
      });
    }
  }
  return contacts.length;
}
