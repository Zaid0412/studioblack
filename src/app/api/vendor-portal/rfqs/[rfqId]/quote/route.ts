import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getProjectName,
  getQuoteForVendor,
  getQuoteStudioRecipients,
  logAuditSafe,
  submitOrUpdateQuote,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  ensureVendorActive,
  ensureVendorPortalEnabled,
} from "@/lib/vendorPortalGuards";
import { parseRequest, submitQuoteSchema } from "@/lib/validations";
import { notifyQuoteReceived } from "@/app/api/projects/[id]/rfqs/_quoteEmails";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/**
 * GET /api/vendor-portal/rfqs/[rfqId]/quote — vendor's own quote for this
 * RFQ, or `null` if they haven't submitted yet (caller renders the submit
 * form). Returns 404 if the vendor is not invited or the RFQ doesn't exist
 * (we hide the distinction so vendors can't probe for RFQ ids).
 */
export const GET = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (_req, { user, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;
    if (!params.rfqId) {
      return NextResponse.json({ error: "Missing rfqId" }, { status: 400 });
    }
    const quote = await getQuoteForVendor(params.rfqId, vendorId!);
    return NextResponse.json({ quote });
  }
);

/**
 * PUT /api/vendor-portal/rfqs/[rfqId]/quote — submit or revise the
 * caller's quote. Idempotent on (rfqId, vendorId) — repeat calls while
 * the quote is in `submitted` overwrite the prior line items wholesale.
 * Returns 409 with code `quote_locked` once the quote is in
 * `under_review` / `awarded` / `rejected` / `expired`.
 */
export const PUT = withAuth(
  { allowedRoles: ["vendor"], fetchVendorId: true },
  async (req, { user, vendorId }, params) => {
    const blocked = await ensureVendorPortalEnabled(user.id);
    if (blocked) return blocked;
    const suspended = await ensureVendorActive(vendorId!);
    if (suspended) return suspended;

    if (!params.rfqId) {
      return NextResponse.json({ error: "Missing rfqId" }, { status: 400 });
    }

    const parsed = await parseRequest(req, submitQuoteSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // A genuine portal (re)submission always re-marks the quote as `portal` —
    // even if a PM had previously recorded it off-channel (email/WhatsApp/…).
    const result = await submitOrUpdateQuote(
      params.rfqId,
      vendorId!,
      parsed.data,
      { responseSource: "portal" }
    );
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string, string?]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [
          409,
          "RFQ is not accepting quotes",
          "rfq_wrong_status",
        ],
        vendor_not_invited: [403, "Vendor is not invited to this RFQ"],
        missing_items: [400, "Quote must cover every RFQ item"],
        extra_items: [400, "Quote contains items not in this RFQ"],
        quote_locked: [
          409,
          "Quote has been locked and cannot be revised",
          "quote_locked",
        ],
      };
      const [status, error, code] = map[result.reason];
      return NextResponse.json({ error, ...(code && { code }) }, { status });
    }

    // Reload the full quote (with vendor name joined + line items) for
    // both the response payload and the email fan-out below.
    const [fresh, recipients, projectName] = await Promise.all([
      getQuoteForVendor(params.rfqId, vendorId!),
      getQuoteStudioRecipients(params.rfqId),
      getProjectName(result.projectId),
    ]);

    void logAuditSafe({
      orgId: result.orgId,
      actorId: user.id,
      action: result.isNew
        ? AUDIT_ACTIONS.QUOTE_SUBMITTED
        : AUDIT_ACTIONS.QUOTE_REVISED,
      targetTable: "vendor_quote",
      targetId: result.quote.id,
      metadata: {
        rfq_id: params.rfqId,
        vendor_id: vendorId,
        item_count: parsed.data.items.length,
        is_late: result.quote.is_late,
        currency: result.quote.currency,
      },
    });

    notifyQuoteReceived(recipients, {
      rfqId: params.rfqId,
      rfqNumber: result.rfqNumber,
      rfqTitle: result.rfqTitle,
      projectId: result.projectId,
      projectName: projectName ?? "Project",
      vendorName: fresh?.vendor_name ?? "Vendor",
      isRevision: !result.isNew,
      isLate: result.quote.is_late,
    }).catch((err: unknown) => {
      logger.warn("Quote received email fan-out failed", {
        rfqId: params.rfqId,
        err: String(err),
      });
    });

    // In-app notifications — fire-and-forget, one per studio recipient.
    const vendorName = fresh?.vendor_name ?? "Vendor";
    const notifTitle = result.isNew ? "Quote received" : "Quote revised";
    const notifDescription = `${vendorName} ${result.isNew ? "submitted" : "revised"} a quote on ${result.rfqNumber}`;
    const notifType = result.isNew ? "quote_received" : "quote_revised";
    for (const recipient of recipients) {
      void createNotification({
        userId: recipient.userId,
        type: notifType,
        title: notifTitle,
        description: notifDescription,
        projectId: result.projectId,
      }).catch((err: unknown) => {
        logger.warn("Quote received in-app notification failed", {
          rfqId: params.rfqId,
          userId: recipient.userId,
          err: String(err),
        });
      });
    }

    return NextResponse.json({ quote: fresh, isNew: result.isNew });
  }
);
