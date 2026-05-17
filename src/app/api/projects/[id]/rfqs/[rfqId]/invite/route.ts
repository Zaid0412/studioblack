import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getProjectName,
  getRfqContactsForEmailByVendors,
  inviteRfqVendors,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { inviteRfqVendorsSchema, parseRequest } from "@/lib/validations";
import { notifyRfqIssued, resolveRfqId } from "../../_helpers";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/invite — add MORE vendors to an
 * already-issued RFQ. Status stays the same; only newly-inserted
 * `rfq_vendor` rows trigger emails (so re-inviting an existing vendor is
 * a no-op rather than a duplicate email).
 *
 * Returns the count of vendors actually added so the UI can render the
 * right toast ("2 vendors invited" vs "All vendors were already on this
 * RFQ"). 409 fires for draft / awarded / cancelled — those use issue or
 * cancel respectively.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, inviteRfqVendorsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await inviteRfqVendors(
      resolved.rfqId,
      parsed.data.vendorIds,
      user.id
    );
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        not_found: [404, "RFQ not found"],
        wrong_status: [
          409,
          "RFQ must be issued (and not awarded/cancelled) to invite more vendors",
        ],
        no_vendors: [400, "At least one vendor is required"],
        bad_vendors: [400, "One or more vendors are invalid for this project"],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    // No new invitees (all picks already on the RFQ) — short-circuit so the
    // UI can show an informative toast and we don't spam the audit log with
    // empty events.
    if (result.addedVendorIds.length === 0) {
      return NextResponse.json({
        rfq: result.rfq,
        addedVendorCount: 0,
        invitedContactCount: 0,
      });
    }

    // Email fan-out — only the NEW invitees, run after commit.
    const [contacts, projectName] = await Promise.all([
      getRfqContactsForEmailByVendors(resolved.rfqId, result.addedVendorIds),
      getProjectName(params.id),
    ]);
    notifyRfqIssued(contacts, {
      rfqId: resolved.rfqId,
      rfqNumber: result.rfq.rfq_number,
      rfqTitle: result.rfq.title,
      projectName: projectName ?? "Project",
      responseDeadline: result.rfq.response_deadline,
    }).catch((err: unknown) => {
      logger.warn("RFQ invite-more email fan-out failed", {
        rfqId: resolved.rfqId,
        err: String(err),
      });
    });

    if (orgId) {
      const namesByVendor = new Map<string, string>();
      for (const c of contacts) namesByVendor.set(c.vendorId, c.vendorName);
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_VENDORS_ADDED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: {
          vendor_ids: result.addedVendorIds,
          vendor_names: result.addedVendorIds.map(
            (id) => namesByVendor.get(id) ?? null
          ),
          invited_contact_count: contacts.length,
        },
      });
    }

    return NextResponse.json({
      rfq: result.rfq,
      addedVendorCount: result.addedVendorIds.length,
      invitedContactCount: contacts.length,
    });
  }
);
