import { betterAuth } from "better-auth";
import { organization, magicLink } from "better-auth/plugins";

import { ac, owner, admin, member, client, vendor } from "@/lib/permissions";
import {
  sendMagicLinkEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email";
import { features } from "@/config/features";
import { getPool } from "@/lib/db";
import {
  linkVendorContactByEmail,
  bulkCreateCategoriesFromTemplates,
} from "@/lib/queries";
import { MASTER_TAXONOMY } from "@/lib/categoryTemplates";
import type { BulkCategoryNode } from "@/lib/validations";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * Resolve the base URL for better-auth.
 *
 * Priority: BETTER_AUTH_URL (explicit) → VERCEL_BRANCH_URL (stable per branch,
 * matches what users typically share) → VERCEL_URL (deployment-specific) →
 * localhost fallback.
 */
function getBaseURL(): string {
  const e = env();
  if (e.BETTER_AUTH_URL) return e.BETTER_AUTH_URL;
  if (e.VERCEL_BRANCH_URL) return `https://${e.VERCEL_BRANCH_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Build the trusted-origins allowlist for better-auth's CSRF check. Vercel
 * exposes three URL variants per deployment (deployment-specific, branch,
 * production) and the user can hit any of them; rejecting non-canonical
 * variants returns INVALID_ORIGIN on sign-in. We trust all available variants.
 */
function getTrustedOrigins(): string[] {
  const e = env();
  const origins = new Set<string>();
  if (e.BETTER_AUTH_URL) origins.add(e.BETTER_AUTH_URL);
  if (e.VERCEL_URL) origins.add(`https://${e.VERCEL_URL}`);
  if (e.VERCEL_BRANCH_URL) origins.add(`https://${e.VERCEL_BRANCH_URL}`);
  if (e.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${e.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (origins.size === 0) origins.add("http://localhost:3000");
  for (const o of e.BETTER_AUTH_EXTRA_TRUSTED_ORIGINS) origins.add(o);
  return Array.from(origins);
}

/**
 * Server-side Better Auth instance.
 *
 * Uses Supabase PostgreSQL as the database (same for dev and production).
 * Custom `role` and `initials` fields are stored on the `user` table.
 * Both fields have `input: false` so they cannot be set via the public
 * sign-up/sign-in API — only via the seed script or direct DB operations.
 *
 * Organisation plugin roles map to PRD definitions:
 *   owner  → PM who created the org (auto-assigned, full access)
 *   admin  → other PMs invited later
 *   member → Architects (update projects, upload docs)
 *
 * Clients are org members with a "client" role — minimal permissions.
 * They access projects via client_email match.
 */
export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  database: getPool(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: features.emailVerification,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 86400, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail(user.email, user.name, url);
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const pool = getPool();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Block deletion if user is the sole owner of any organization
          const { rows: soleOwnerOrgs } = await client.query(
            `SELECT m."organizationId" FROM "member" m
             WHERE m."userId" = $1 AND m.role = 'owner'
             AND NOT EXISTS (
               SELECT 1 FROM "member" m2
               WHERE m2."organizationId" = m."organizationId"
                 AND m2."userId" != $1 AND m2.role = 'owner'
             )`,
            [user.id]
          );
          if (soleOwnerOrgs.length > 0) {
            throw new Error(
              "Cannot delete account: you are the sole owner of an organization. Transfer ownership first."
            );
          }

          // Nullify FK references before user row deletion so
          // ON DELETE SET NULL triggers don't hit NOT NULL constraints.
          await Promise.all([
            client.query(
              `UPDATE attachment SET
                 uploaded_by = CASE WHEN uploaded_by = $1 THEN NULL ELSE uploaded_by END,
                 reviewed_by = CASE WHEN reviewed_by = $1 THEN NULL ELSE reviewed_by END,
                 sent_to_client_by = CASE WHEN sent_to_client_by = $1 THEN NULL ELSE sent_to_client_by END
               WHERE uploaded_by = $1 OR reviewed_by = $1 OR sent_to_client_by = $1`,
              [user.id]
            ),
            client.query(
              `UPDATE comment SET user_id = NULL WHERE user_id = $1`,
              [user.id]
            ),
            client.query(
              `UPDATE project SET created_by = NULL WHERE created_by = $1`,
              [user.id]
            ),
            client.query(
              `UPDATE phase_task SET assigned_to = NULL WHERE assigned_to = $1`,
              [user.id]
            ),
          ]);

          // Clean up better-auth org plugin tables BEFORE user row is deleted,
          // otherwise FK constraints on member/invitation block the deletion.
          await client.query(`DELETE FROM "member" WHERE "userId" = $1`, [
            user.id,
          ]);
          await client.query(
            `DELETE FROM "invitation" WHERE "inviterId" = $1`,
            [user.id]
          );

          await client.query("COMMIT");
          logger.info("Cleaned up org membership before user deletion", {
            email: user.email,
          });
        } catch (err) {
          await client.query("ROLLBACK");
          // Re-throw sole-owner guard — let everything else fail gracefully
          if (err instanceof Error && err.message.includes("sole owner")) {
            throw err;
          }
          logger.error("beforeDelete cleanup failed", {
            email: user.email,
            error: err,
          });
        } finally {
          client.release();
        }
      },
    },
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "pm",
        input: false,
      },
      initials: {
        type: "string",
        required: false,
        defaultValue: "",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const pool = getPool();

          const { rows: invRows } = await pool.query(
            `SELECT 1 FROM "invitation" WHERE email = $1 AND role = 'client' AND status = 'pending' LIMIT 1`,
            [user.email]
          );
          if (invRows.length > 0) {
            await pool.query(
              `UPDATE "user" SET role = 'client' WHERE id = $1`,
              [user.id]
            );
            return;
          }

          const { rows: vendorInvRows } = await pool.query(
            `SELECT 1 FROM "invitation" WHERE email = $1 AND role = 'vendor' AND status = 'pending' LIMIT 1`,
            [user.email]
          );
          if (vendorInvRows.length > 0) {
            await Promise.all([
              pool.query(`UPDATE "user" SET role = 'vendor' WHERE id = $1`, [
                user.id,
              ]),
              linkVendorContactByEmail(user.id, user.email),
            ]);
            return;
          }

          // Backward compat: email matches a project's client_email → client role.
          const { rows } = await pool.query(
            `SELECT 1 FROM project WHERE client_email = $1 LIMIT 1`,
            [user.email]
          );
          if (rows.length > 0) {
            await pool.query(
              `UPDATE "user" SET role = 'client' WHERE id = $1`,
              [user.id]
            );
            return;
          }

          // Backward compat: email matches an unlinked vendor_contact → vendor role.
          const { rows: vcRows } = await pool.query(
            `SELECT 1 FROM vendor_contact WHERE TRIM(LOWER(email)) = TRIM(LOWER($1)) AND user_id IS NULL LIMIT 1`,
            [user.email]
          );
          if (vcRows.length > 0) {
            await Promise.all([
              pool.query(`UPDATE "user" SET role = 'vendor' WHERE id = $1`, [
                user.id,
              ]),
              linkVendorContactByEmail(user.id, user.email),
            ]);
          }
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles: { owner, admin, member, client, vendor },
      async sendInvitationEmail({ id, email, organization: org, inviter }) {
        const baseUrl = getBaseURL();
        const inviteLink = `${baseUrl}/register?invitationId=${id}&email=${encodeURIComponent(email)}`;
        await sendInvitationEmail(
          email,
          inviter.user.name,
          org.name,
          inviteLink
        );
      },
      organizationHooks: {
        // Every new org gets the shared master taxonomy (Category → Sub-category
        // → Service Area) seeded by default, so categories exist out of the box
        // instead of requiring the "Use a starter set" flow. Idempotent, and
        // wrapped so a seeding failure never blocks org creation (it can be
        // re-run from the /categories page).
        afterCreateOrganization: async ({ organization }) => {
          try {
            await bulkCreateCategoriesFromTemplates(
              organization.id,
              MASTER_TAXONOMY as readonly BulkCategoryNode[]
            );
          } catch (err) {
            logger.error("Failed to seed default categories for new org", {
              orgId: organization.id,
              error: err,
            });
          }
        },
        // Catches the existing-user-accepts-vendor-invite path. The user-table
        // databaseHook only fires for new signups; once the user already exists,
        // the org plugin's `acceptInvitation` calls `adapter.create` for the
        // member row directly (no `createWithHooks`), so the only reliable place
        // to react is the org plugin's own hook.
        afterAcceptInvitation: async ({ member, user }) => {
          if (member.role !== "vendor") return;
          const pool = getPool();
          // Re-read the user's current role; the `user` argument may be stale
          // if the user.create.after hook just promoted this account.
          const { rows } = await pool.query(
            `SELECT role FROM "user" WHERE id = $1`,
            [user.id]
          );
          const currentRole = rows[0]?.role as string | undefined;
          // New-user signups are already handled by user.create.after — bail
          // here to avoid a redundant no-op UPDATE on vendor_contact.
          if (currentRole === "vendor") return;
          // Never demote a PM. Architects / clients accepting a vendor invite
          // are explicitly being re-roled.
          const shouldRerole = currentRole !== "pm";
          await Promise.all([
            linkVendorContactByEmail(user.id, user.email),
            shouldRerole
              ? pool.query(`UPDATE "user" SET role = 'vendor' WHERE id = $1`, [
                  user.id,
                ])
              : Promise.resolve(),
          ]);
        },
      },
    }),
    magicLink({
      async sendMagicLink({ email, url }) {
        await sendMagicLinkEmail(email, url);
      },
      disableSignUp: true,
      expiresIn: 60 * 15, // 15 minutes
    }),
  ],
});

// Startup safety check: warn if email verification is enabled but
// existing users haven't been migrated (would lock them out on login).
if (features.emailVerification) {
  getPool()
    .query(
      `SELECT COUNT(*)::int AS cnt FROM "user" WHERE "emailVerified" = false OR "emailVerified" IS NULL`
    )
    .then(({ rows }) => {
      if (rows[0].cnt > 0) {
        logger.warn(
          `${rows[0].cnt} user(s) have unverified emails — they will be blocked from signing in. Run scripts/migrate-verify-existing-users.sql to grandfather them.`
        );
      }
    })
    .catch(() => {
      // Non-blocking — pool may not be ready at import time in some envs
    });
}
