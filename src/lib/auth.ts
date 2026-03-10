import { betterAuth } from "better-auth";
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
 */
export const auth = betterAuth({
  baseURL: getBaseURL(),
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
        defaultValue: "architect",
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
});
