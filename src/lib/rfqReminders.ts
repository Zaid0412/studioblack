import type { DueRfqReminder } from "@/lib/queries/rfqs";
import { getDueRfqReminders, markRfqVendorsReminded } from "@/lib/queries/rfqs";
import { sendRfqReminderEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { env } from "@/env";

export interface RfqReminderRunResult {
  /** Distinct RFQs that had at least one vendor reminded. */
  rfqs: number;
  /** Distinct (rfq, vendor) pairs stamped. */
  vendors: number;
  /** Reminder emails attempted (the send didn't throw) — not a delivery guarantee. */
  emails: number;
}

/**
 * Email every vendor contact due for an RFQ reminder (see `getDueRfqReminders`),
 * stamping each vendor as soon as its email(s) have been attempted.
 *
 * Stamping per vendor — rather than once at the very end — keeps a run crash-safe:
 * if the function is killed part-way (many due vendors × SMTP latency), the
 * vendors already emailed stay stamped and only the untouched tail is retried
 * next run, so nobody gets a duplicate reminder.
 *
 * Sends are fire-and-forget — a failed email is logged, not retried, and the
 * vendor is stamped regardless, so a bad address doesn't get re-tried daily.
 */
export async function runRfqReminders(): Promise<RfqReminderRunResult> {
  const due = await getDueRfqReminders();
  if (due.length === 0) return { rfqs: 0, vendors: 0, emails: 0 };

  const appUrl = env().NEXT_PUBLIC_APP_URL ?? "";

  // Group the emailable contacts by (rfq, vendor) so each vendor is stamped once,
  // immediately after all its contacts have been emailed.
  const byVendor = new Map<string, DueRfqReminder[]>();
  for (const d of due) {
    const key = `${d.rfqId}:${d.vendorId}`;
    const group = byVendor.get(key);
    if (group) group.push(d);
    else byVendor.set(key, [d]);
  }

  let emails = 0;
  const rfqs = new Set<string>();
  for (const group of byVendor.values()) {
    for (const d of group) {
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
    const { rfqId, vendorId } = group[0];
    await markRfqVendorsReminded([{ rfqId, vendorId }]);
    rfqs.add(rfqId);
  }

  return { rfqs: rfqs.size, vendors: byVendor.size, emails };
}
