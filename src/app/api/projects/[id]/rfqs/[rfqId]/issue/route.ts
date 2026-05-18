import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getProjectName,
  getRfqContactsForEmail,
  issueRfq,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { issueRfqSchema, parseRequest } from "@/lib/validations";
import { notifyRfqIssued, resolveRfqId } from "../../_helpers";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/issue — flip a draft RFQ to `issued`
 * and email every `receives_rfq=true` contact of the selected vendors.
 *
 * Email fan-out runs AFTER the DB transaction commits (so SMTP failures
 * don't roll back the issue) and is fire-and-forget at the response level —
 * the route returns 200 with the updated RFQ and the email send count.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, issueRfqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await issueRfq(
      resolved.rfqId,
      parsed.data.vendorIds,
      user.id
    );
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        not_found: [404, "RFQ not found"],
        wrong_status: [409, "RFQ is not in draft and cannot be issued"],
        no_items: [422, "RFQ has no items"],
        bad_vendors: [400, "One or more vendors are invalid for this project"],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    // Email fan-out — run after commit, do not let SMTP errors propagate.
    const [contacts, projectName] = await Promise.all([
      getRfqContactsForEmail(resolved.rfqId),
      getProjectName(params.id),
    ]);
    notifyRfqIssued(contacts, {
      rfqId: resolved.rfqId,
      rfqNumber: result.rfq.rfq_number,
      rfqTitle: result.rfq.title,
      projectName: projectName ?? "Project",
      responseDeadline: result.rfq.response_deadline,
    }).catch((err: unknown) => {
      logger.warn("RFQ issue email fan-out failed", {
        rfqId: resolved.rfqId,
        err: String(err),
      });
    });

    if (orgId) {
      // Capture vendor display names in the audit row so the timeline can
      // render "Issued to Anatolia Tile, Hansgrohe…" without an extra
      // vendor lookup at read time. `contacts` already has names because
      // it's joined from vendor — dedupe by vendorId.
      const namesByVendor = new Map<string, string>();
      for (const c of contacts) namesByVendor.set(c.vendorId, c.vendorName);
      const vendorIds = Array.from(new Set(parsed.data.vendorIds));
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_ISSUED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: {
          vendor_ids: vendorIds,
          vendor_names: vendorIds.map((id) => namesByVendor.get(id) ?? null),
          invited_contact_count: contacts.length,
          response_deadline: result.rfq.response_deadline,
        },
      });
    }

    return NextResponse.json({
      rfq: result.rfq,
      invitedContactCount: contacts.length,
    });
  }
);
