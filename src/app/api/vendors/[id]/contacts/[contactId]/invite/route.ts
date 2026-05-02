import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { withAuth } from "@/lib/withAuth";
import {
  getUserByEmail,
  getVendorContactEmail,
  linkVendorContactByEmail,
  validateOrgMembership,
} from "@/lib/queries";
import { logger } from "@/lib/logger";
import { getServerFeatureFlag } from "@/lib/posthog-server";

/**
 * POST /api/vendors/[id]/contacts/[contactId]/invite
 *
 * Invites a vendor contact to the vendor portal. If a user with the contact's
 * email is already an org member, links `vendor_contact.user_id` directly
 * (no email sent). Otherwise sends a fresh better-auth invitation with
 * `role="vendor"`; the `member.create.after` hook finalises the link on accept.
 */
export const POST = withAuth(
  { allowedRoles: ["pm"] },
  async (_req, { orgId, user, requestId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    // Defence-in-depth: the UI button is also gated on this flag.
    const enabled = await getServerFeatureFlag("vendorPortal", user.id, false);
    if (!enabled) {
      return NextResponse.json(
        { error: "Vendor portal is not enabled" },
        { status: 403 }
      );
    }

    const vendorId = params.id;
    const contactId = params.contactId;

    const email = await getVendorContactEmail(orgId, vendorId, contactId);
    if (!email) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const existingUser = await getUserByEmail(email.toLowerCase());

    if (existingUser) {
      const isMember = await validateOrgMembership(orgId, existingUser.id);
      if (isMember) {
        await linkVendorContactByEmail(existingUser.id, email);
        logger.info("Vendor contact linked to existing org member", {
          requestId,
          vendorId,
          contactId,
          userId: existingUser.id,
        });
        return NextResponse.json({ status: "linked" });
      }
    }

    try {
      const reqHeaders = await headers();
      await auth.api.createInvitation({
        headers: reqHeaders,
        body: {
          email,
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
