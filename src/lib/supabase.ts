import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}
