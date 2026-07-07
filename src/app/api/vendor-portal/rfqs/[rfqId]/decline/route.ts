import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  declineQuote,
  getQuoteStudioRecipients,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  ensureVendorActive,
  ensureVendorPortalEnabled,
} from "@/lib/vendorPortalGuards";
import { declineQuoteSchema, parseRequest } from "@/lib/validations";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/**
 * PUT /api/vendor-portal/rfqs/[rfqId]/decline — the caller declines to quote
 * this RFQ (§14). Records a `declined` quote with an optional reason and
 * notifies the studio. The vendor can still un-decline later by submitting a
 * real quote (that path overwrites the declined row).
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

    const parsed = await parseRequest(req, declineQuoteSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await declineQuote(params.rfqId, vendorId!, {
      responseSource: "portal",
      reason: parsed.data.reason ?? null,
    });
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string, string?]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [
          409,
          "RFQ is not accepting quotes",
          "rfq_wrong_status",
        ],
        vendor_not_invited: [403, "Vendor is not invited to this RFQ"],
        quote_locked: [
          409,
          "Quote has been locked and cannot be declined",
          "quote_locked",
        ],
      };
      const [status, error, code] = map[result.reason];
      return NextResponse.json({ error, ...(code && { code }) }, { status });
    }

    void logAuditSafe({
      orgId: result.orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.QUOTE_DECLINED,
      targetTable: "vendor_quote",
      targetId: result.quote.id,
      metadata: {
        rfq_id: params.rfqId,
        vendor_id: vendorId,
        reason: parsed.data.reason ?? null,
      },
    });

    const recipients = await getQuoteStudioRecipients(params.rfqId);
    for (const recipient of recipients) {
      void createNotification({
        userId: recipient.userId,
        type: "quote_declined",
        title: "Vendor declined",
        description: `${result.vendorName} declined to quote on ${result.rfqNumber}`,
        projectId: result.projectId,
      }).catch((err: unknown) => {
        logger.warn("Quote declined in-app notification failed", {
          rfqId: params.rfqId,
          userId: recipient.userId,
          err: String(err),
        });
      });
    }

    return NextResponse.json({ quote: result.quote });
  }
);
