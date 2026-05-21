import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  awardRfqSplit,
  getProjectName,
  getQuoteAwardContacts,
  getQuotesByRfq,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { awardRfqSplitSchema, parseRequest } from "@/lib/validations";
import { deriveRoleFlags } from "@/lib/roles";
import { resolveRfqId } from "../../_helpers";
import { notifyQuoteAwarded } from "../../_quoteEmails";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/award-split — per-item award.
 * PM only. Different items can go to different vendors. Every RFQ item
 * must be assigned (no partial splits). Winning quotes flip to
 * `awarded`; quotes with no wins flip to `rejected`. RFQ.awarded_vendor_id
 * stays null (no single winner).
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

    const parsed = await parseRequest(req, awardRfqSplitSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await awardRfqSplit(
      resolved.rfqId,
      parsed.data.awards,
      user.id
    );
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [409, "RFQ cannot be awarded in its current status"],
        quote_not_found: [400, "One or more quote items are invalid"],
        quote_expired: [
          409,
          "An awarded quote has expired — request a fresh submission",
        ],
        incomplete_split: [
          400,
          "Every RFQ item must be assigned to a quote item",
        ],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    // Identify winning vendors by reading the post-award quote list. The
    // award flow flipped winners to `awarded` and others to `rejected`
    // inside the tx, so a single read here is sufficient.
    const allQuotes = await getQuotesByRfq(resolved.rfqId);
    const winningVendors = allQuotes
      .filter((q) => q.status === "awarded")
      .map((q) => ({
        vendor_id: q.vendor_id,
        vendor_name: q.vendor_name,
      }));

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_AWARDED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: {
          award_type: "split",
          winning_vendor_ids: winningVendors.map((v) => v.vendor_id),
          winning_vendor_names: winningVendors.map((v) => v.vendor_name),
          assignment_count: parsed.data.awards.length,
        },
      });
      // Per-vendor quote.awarded entries for the timeline.
      for (const v of winningVendors) {
        void logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.QUOTE_AWARDED,
          targetTable: "vendor_quote",
          targetId:
            allQuotes.find((q) => q.vendor_id === v.vendor_id)?.id ?? "",
          metadata: {
            rfq_id: resolved.rfqId,
            vendor_id: v.vendor_id,
            vendor_name: v.vendor_name,
            award_type: "split",
          },
        });
      }
    }

    // Email every winning vendor in parallel-by-vendor (sequential within
    // a vendor's contacts via notifyQuoteAwarded).
    const projectName = await getProjectName(params.id);
    for (const v of winningVendors) {
      void (async () => {
        try {
          const contacts = await getQuoteAwardContacts(
            resolved.rfqId,
            v.vendor_id
          );
          await notifyQuoteAwarded(contacts, {
            rfqId: resolved.rfqId,
            rfqNumber: result.rfq.rfq_number,
            rfqTitle: result.rfq.title,
            projectName: projectName ?? "Project",
          });
        } catch (err) {
          logger.warn("Quote awarded email fan-out failed", {
            rfqId: resolved.rfqId,
            vendorId: v.vendor_id,
            err: String(err),
          });
        }
      })();
    }

    return NextResponse.json({ rfq: result.rfq });
  }
);
