import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { withAuth } from "@/lib/withAuth";
import { getVendorById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getServerFeatureFlag } from "@/lib/posthog-server";

/**
 * POST /api/vendors/[id]/contacts/[contactId]/invite
 *
 * Invites a vendor contact to the vendor portal. Two paths:
 *
 * 1. **Already an org member** — user with this email exists and is in the
 *    org (e.g. PM testing with their own account, or vendor previously
 *    invited as architect). We skip the email and just backfill
 *    `vendor_contact.user_id` so the contact reads as "Linked".
 *
 * 2. **Not an org member** — calls `auth.api.createInvitation` with
 *    role="vendor". On accept, the `databaseHooks.member.create.after` hook
 *    finalises the link.
 */
export const POST = withAuth(
  { allowedRoles: ["pm"] },
  async (_req, { orgId, user, requestId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    // Gate vendor invites until F9/F14/F15/F16.6 ship — flag off in production,
    // on in preview/development. Defence-in-depth: the UI button is also flagged.
    const enabled = await getServerFeatureFlag("vendorPortal", user.id, false);
    if (!enabled) {
      return NextResponse.json(
        { error: "Vendor portal is not enabled" },
        { status: 403 }
      );
    }

    const vendorId = params.id;
    const contactId = params.contactId;

    const vendor = await getVendorById(orgId, vendorId);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const contact = vendor.contacts.find((c) => c.id === contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const pool = getPool();

    // better-auth normalises emails to lowercase before storing — match the
    // same way to avoid casing mismatches falling through to createInvitation
    // (which does its own normalisation and errors with "already a member").
    const normalisedEmail = contact.email.toLowerCase();
    const { rows: userRows } = await pool.query(
      `SELECT id FROM "user" WHERE LOWER(email) = $1 LIMIT 1`,
      [normalisedEmail]
    );
    const existingUserId = userRows[0]?.id as string | undefined;

    if (existingUserId) {
      const { rows: memberRows } = await pool.query(
        `SELECT 1 FROM "member" WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1`,
        [existingUserId, orgId]
      );
      if (memberRows.length > 0) {
        await pool.query(
          `UPDATE vendor_contact SET user_id = $1 WHERE id = $2 AND user_id IS NULL`,
          [existingUserId, contactId]
        );
        logger.info("Vendor contact linked to existing org member", {
          requestId,
          vendorId,
          contactId,
          userId: existingUserId,
        });
        return NextResponse.json({ status: "linked" });
      }
    }

    // Send a new invitation (or resend if better-auth detects an existing one).
    try {
      const reqHeaders = await headers();
      await auth.api.createInvitation({
        headers: reqHeaders,
        body: {
          email: contact.email,
          role: "vendor",
          organizationId: orgId,
          resend: true,
        },
      });
    } catch (err) {
      logger.error("Failed to create vendor invitation", {
        requestId,
        vendorId,
        contactId,
        error: err,
      });
      const message =
        err instanceof Error ? err.message : "Failed to send invitation";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ status: "invited" });
  }
);
