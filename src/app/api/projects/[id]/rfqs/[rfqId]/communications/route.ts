import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getRfqVendorName,
  logAuditSafe,
  markVendorDistributionMixed,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  logRfqCommunicationSchema,
  parseRequest,
  RFQ_DISTRIBUTION_CHANNELS,
} from "@/lib/validations";
import { resolveRfqId } from "../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/communications — pm/architect. Log a
 * manual, channel-tagged communication (PRD §17). Recorded as an
 * `rfq.communication_logged` audit event so it shows up in the RFQ activity
 * timeline alongside the system events — no separate table.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    // The audit event is this route's only persistence — without an org we'd
    // silently drop it while returning success, so fail fast instead.
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organisation" },
        { status: 400 }
      );
    }

    const parsed = await parseRequest(req, logRfqCommunicationSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { channel, vendorId, remarks } = parsed.data;

    // Denormalise the vendor name so the timeline renders without a lookup;
    // also validates the vendor is actually on this RFQ.
    const vendorName = vendorId
      ? await getRfqVendorName(resolved.rfqId, vendorId)
      : null;
    if (vendorId && vendorName === null) {
      return NextResponse.json(
        { error: "Vendor is not on this RFQ" },
        { status: 400 }
      );
    }

    await logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.RFQ_COMMUNICATION_LOGGED,
      targetTable: "rfq",
      targetId: resolved.rfqId,
      metadata: {
        channel,
        vendor_id: vendorId ?? null,
        vendor_name: vendorName,
        remarks,
      },
    });

    // §11: reaching a vendor through a channel other than how the RFQ was first
    // distributed makes their distribution "mixed".
    if (vendorId && RFQ_DISTRIBUTION_CHANNELS.has(channel)) {
      await markVendorDistributionMixed(resolved.rfqId, vendorId, channel);
    }

    return NextResponse.json({ ok: true });
  }
);
