import { getDueRfqReminders, markRfqVendorsReminded } from "@/lib/queries/rfqs";
import { sendRfqReminderEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { env } from "@/env";

export interface RfqReminderRunResult {
  /** Distinct RFQs that had at least one vendor reminded. */
  rfqs: number;
  /** Distinct (rfq, vendor) pairs stamped. */
  vendors: number;
  /** Reminder emails successfully handed to SMTP. */
  emails: number;
}

/**
 * Email every vendor contact due for an RFQ reminder (see `getDueRfqReminders`),
 * then stamp each vendor so the next run waits a full 3 days.
 *
 * Sends are fire-and-forget — a failed email is logged, not retried, and the
 * vendor is stamped regardless, so a bad address doesn't get re-tried daily.
 */
export async function runRfqReminders(): Promise<RfqReminderRunResult> {
  const due = await getDueRfqReminders();
  if (due.length === 0) return { rfqs: 0, vendors: 0, emails: 0 };

  const appUrl = env().NEXT_PUBLIC_APP_URL ?? "";
  let emails = 0;
  for (const d of due) {
    try {
      await sendRfqReminderEmail(d.contactEmail, {
        contactName: d.contactName,
        projectName: d.projectName,
        rfqNumber: d.rfqNumber,
        rfqTitle: d.rfqTitle,
        responseDeadline: d.responseDeadline,
        deepLink: `${appUrl}/rfqs/${d.rfqId}`,
        reminderNumber: d.reminderCount + 1,
      });
      emails++;
    } catch (err) {
      logger.warn("RFQ reminder email failed", {
        rfqId: d.rfqId,
        vendorId: d.vendorId,
        err: String(err),
      });
    }
  }

  // One stamp per (rfq, vendor) — dedupe across a vendor's multiple contacts.
  const pairs = Array.from(
    new Map(
      due.map((d) => [
        `${d.rfqId}:${d.vendorId}`,
        { rfqId: d.rfqId, vendorId: d.vendorId },
      ])
    ).values()
  );
  await markRfqVendorsReminded(pairs);

  return {
    rfqs: new Set(due.map((d) => d.rfqId)).size,
    vendors: pairs.length,
    emails,
  };
}
