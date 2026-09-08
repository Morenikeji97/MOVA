import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { assertSupabaseKey } from "./keys";

/**
 * Privileged server-side Supabase client. Bypasses Row-Level Security, so it
 * must only be used server-side in trusted contexts (e.g. verified Stripe
 * webhooks) — never in a request handler that takes its input from an end
 * user's session.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only; never expose as NEXT_PUBLIC).
 * That env var holds a new-format Supabase secret key (`sb_secret_…`), a drop-in
 * replacement for the legacy `service_role` JWT. The env var name is kept for a
 * minimal diff.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  const serviceRoleKey = assertSupabaseKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "secret",
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
