import { z } from "zod";

/**
 * Type-safe environment variables.
 *
 * Server vars are validated lazily on first access (avoids build-time crashes
 * when env isn't set, e.g. CI). Client vars (`NEXT_PUBLIC_*`) are validated at
 * module load since Next.js inlines them at build time.
 */

// ── Schemas ──────────────────────────────────────────────────────────────────

const serverSchema = z.object({
  // Database & Storage
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Google OAuth (optional — feature-flagged)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // SMTP (all optional — email features degrade gracefully)
  SMTP_HOST: z.string().default("smtp-relay.brevo.com"),
  SMTP_PORT: z.string().default("587"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

// ── Types ────────────────────────────────────────────────────────────────────

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

// ── Server env (lazy singleton) ──────────────────────────────────────────────

let _serverEnv: ServerEnv | null = null;

/** Returns validated server-side env vars. Throws on first call if invalid. */
export function env(): ServerEnv {
  if (!_serverEnv) {
    const result = serverSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const formatted = Object.entries(errors)
        .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${formatted}`);
    }
    _serverEnv = result.data;
  }
  return _serverEnv;
}

// ── Client env (validated at module load) ────────────────────────────────────

function createClientEnv(): ClientEnv {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    // Don't throw during build — NEXT_PUBLIC vars may not be set in CI
    if (typeof window !== "undefined") {
      console.error(
        "Invalid client environment variables:",
        result.error.flatten().fieldErrors
      );
    }
    // Return defaults so the build doesn't crash
    return {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };
  }
  return result.data;
}

export const clientEnv = createClientEnv();
