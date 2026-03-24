import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Supabase admin client for server-side operations.
 *
 * Uses the service role key — must NEVER be imported in client components.
 * Currently used for Storage uploads (avatar images).
 *
 * Lazily initialised so the build doesn't crash when env vars are absent
 * (e.g. CI without Supabase credentials).
 */
let _client: SupabaseClient | null = null;

/** Return the lazily-initialised Supabase admin client. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      env().NEXT_PUBLIC_SUPABASE_URL,
      env().SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _client;
}
