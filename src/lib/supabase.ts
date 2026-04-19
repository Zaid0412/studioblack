import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Supabase admin client for server-side operations.
 *
 * Uses the service role key — must NEVER be imported in client components.
 * Currently used for Storage uploads (avatar images).
 *
 * Uses globalThis to survive Next.js dev-mode hot reloads without leaking
 * connections (each HMR cycle re-evaluates modules but globalThis persists).
 */
const globalForSupabase = globalThis as unknown as {
  supabaseAdmin?: SupabaseClient;
};

/** Return the lazily-initialised Supabase admin client. */
export function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.supabaseAdmin) return globalForSupabase.supabaseAdmin;

  const client = createClient(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().SUPABASE_SERVICE_ROLE_KEY
  );

  globalForSupabase.supabaseAdmin = client;
  return client;
}
