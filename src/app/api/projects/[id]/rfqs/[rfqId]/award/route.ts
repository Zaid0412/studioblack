import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  awardRfqSingle,
  getProjectName,
  getQuoteDetail,
  getRfqContactsForEmail,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { awardRfqSingleSchema, parseRequest } from "@/lib/validations";
import { deriveRoleFlags } from "@/lib/roles";
import { resolveRfqId } from "../../_helpers";
import { notifyQuoteAwarded } from "../../_quoteEmails";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/award — single-vendor award.
 * PM only. Sets winning quote = `awarded`, losers = `rejected`, RFQ
 * status = `awarded`, awarded_vendor_id = winner. BOQ items referenced
 * by the RFQ flip po_status `rfq_issued -> quoted`. Loser emails are
 * intentionally silent in F10 (less awkward; can be added behind a
 * feature flag later).
 */
export const POST = withAuth(
  {
    projectAccess: true,
    blockedRoles: ["client", "vendor"],
    fetchOrgRole: true,
  },
  async (req, { user, orgId, orgRole, effectiveRole }, params) => {
    const { isPM } = deriveRoleFlags(orgRole, effectiveRole);
    if (!isPM) {
      return NextResponse.json(
        { error: "Only project managers can award RFQs" },
        { status: 403 }
      );
    }

    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, awardRfqSingleSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Probe the quote cross-RFQ guard before firing the mutation.
    const winningQuote = await getQuoteDetail(parsed.data.quoteId);
    if (!winningQuote || winningQuote.rfq_id !== resolved.rfqId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const result = await awardRfqSingle(
      resolved.rfqId,
      parsed.data.quoteId,
      user.id
    );
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [409, "RFQ cannot be awarded in its current status"],
        quote_not_found: [404, "Quote not found"],
        quote_expired: [
          409,
          "Quote has expired and cannot be awarded — request a fresh submission",
        ],
        quote_declined: [409, "This vendor declined to quote this RFQ"],
        incomplete_quote: [
          409,
          "This quote doesn't cover every RFQ item — use a split award or request full pricing before awarding to a single vendor",
        ],
        incomplete_split: [400, "Invalid split award"],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.QUOTE_AWARDED,
        targetTable: "vendor_quote",
        targetId: parsed.data.quoteId,
        metadata: {
          rfq_id: resolved.rfqId,
          vendor_id: result.winningVendorId,
          vendor_name: result.winningVendorName,
          award_type: "single",
        },
      });
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_AWARDED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: {
          award_type: "single",
          winning_vendor_id: result.winningVendorId,
          winning_vendor_name: result.winningVendorName,
        },
      });
    }

    // Email the winning vendor (fire-and-forget). Scope F9's contact
    // resolver to just the winning vendor so the shape matches.
    const [contacts, projectName] = await Promise.all([
      getRfqContactsForEmail(resolved.rfqId, [result.winningVendorId]),
      getProjectName(params.id),
    ]);
    notifyQuoteAwarded(contacts, {
      rfqId: resolved.rfqId,
      rfqNumber: result.rfq.rfq_number,
      rfqTitle: result.rfq.title,
      projectName: projectName ?? "Project",
    }).catch((err: unknown) => {
      logger.warn("Quote awarded email fan-out failed", {
        rfqId: resolved.rfqId,
        err: String(err),
      });
    });

    return NextResponse.json({ rfq: result.rfq });
  }
);
