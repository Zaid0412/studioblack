import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Server-side Better Auth instance.
 *
 * Uses Supabase PostgreSQL as the database (same for dev and production).
 * Custom `role` and `initials` fields are stored on the `user` table.
 * Both fields have `input: false` so they cannot be set via the public
 * sign-up/sign-in API — only via the seed script or direct DB operations.
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
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
