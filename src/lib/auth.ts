import { betterAuth } from "better-auth";
import { organization, magicLink } from "better-auth/plugins";

import { ac, owner, admin, member } from "@/lib/permissions";
import {
  sendMagicLinkEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";
import { getPool } from "@/lib/db";
import { env } from "@/env";

/**
 * Resolve the base URL for better-auth.
 *
 * Priority: BETTER_AUTH_URL (explicit) → VERCEL_URL (auto-set by Vercel on
 * preview + production deployments) → localhost fallback.
 */
function getBaseURL(): string {
  const e = env();
  if (e.BETTER_AUTH_URL) return e.BETTER_AUTH_URL;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
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
 * Clients are NOT org members — they access projects via magic link.
 */
export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: [getBaseURL()],
  database: getPool(),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const pool = getPool();
        try {
          // Block deletion if user is the sole owner of any organization
          const { rows: soleOwnerOrgs } = await pool.query(
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

          // Clean up better-auth org plugin tables BEFORE user row is deleted,
          // otherwise FK constraints on member/invitation block the deletion.
          await pool.query(`DELETE FROM "member" WHERE "userId" = $1`, [
            user.id,
          ]);
          await pool.query(`DELETE FROM "invitation" WHERE "inviterId" = $1`, [
            user.id,
          ]);
          console.log(`[auth] Cleaned up org membership for ${user.email}`);
        } catch (err) {
          // Re-throw sole-owner guard — let everything else fail gracefully
          if (err instanceof Error && err.message.includes("sole owner")) {
            throw err;
          }
          console.error("[auth] beforeDelete cleanup failed:", err);
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
          // If the new user's email matches a project's client_email, set role to "client"
          const pool = getPool();
          const { rows } = await pool.query(
            `SELECT 1 FROM project WHERE client_email = $1 LIMIT 1`,
            [user.email]
          );
          if (rows.length > 0) {
            await pool.query(
              `UPDATE "user" SET role = 'client' WHERE id = $1`,
              [user.id]
            );
          }
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles: { owner, admin, member },
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
