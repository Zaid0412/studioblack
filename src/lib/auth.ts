import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { Pool } from "pg";

/**
 * Resolve the base URL for better-auth.
 *
 * Priority: BETTER_AUTH_URL (explicit) → VERCEL_URL (auto-set by Vercel on
 * preview + production deployments) → localhost fallback.
 */
function getBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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
 *   client → Clients (review, approve, attach docs)
 */
export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: [getBaseURL()],
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: true,
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
  plugins: [
    organization({
      async sendInvitationEmail({ email, organization, inviter }) {
        // TODO: Replace with real email service (Resend, SendGrid, etc.)
        console.log(
          `[Invitation] ${inviter.user.name} invited ${email} to ${organization.name}`
        );
      },
    }),
  ],
});
