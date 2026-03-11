import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
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
 * Access-control statements for the organisation plugin.
 *
 * Each key is a resource, each value lists the allowed actions.
 * Roles below map to PRD definitions:
 *   PM        → creates users & projects, full control
 *   Architect → updates projects, uploads/attaches docs
 *   Client    → reviews, approves, attaches docs
 */
const statements = {
  project: ["create", "read", "update", "delete"],
  design: ["upload", "submit", "approve", "request-changes"],
  member: ["create", "read", "update", "remove"],
} as const;

export const ac = createAccessControl(statements);

/** PM = "admin" in better-auth terms (owner is auto-granted all). */
const adminRole = ac.newRole({
  project: ["create", "read", "update", "delete"],
  design: ["upload", "submit", "approve", "request-changes"],
  member: ["create", "read", "update", "remove"],
});

/** Architect = "member" in better-auth terms. */
const memberRole = ac.newRole({
  project: ["read", "update"],
  design: ["upload", "submit"],
  member: ["read"],
});

/** Client — custom role added on top of the defaults. */
const clientRole = ac.newRole({
  project: ["read"],
  design: ["approve", "request-changes"],
  member: ["read"],
});

/**
 * Server-side Better Auth instance.
 *
 * Uses Supabase PostgreSQL as the database (same for dev and production).
 * Custom `role` and `initials` fields are stored on the `user` table.
 * Both fields have `input: false` so they cannot be set via the public
 * sign-up/sign-in API — only via the seed script or direct DB operations.
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
      ac,
      roles: {
        admin: adminRole,
        member: memberRole,
        client: clientRole,
      },
    }),
  ],
});
