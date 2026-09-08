import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { assertSupabaseKey } from "./keys";

// NEXT_PUBLIC_SUPABASE_ANON_KEY holds a new-format Supabase publishable key
// (`sb_publishable_…`) — a drop-in for the legacy `anon` JWT, same low
// (RLS-bound) privilege. The env var name is kept for a minimal diff.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    assertSupabaseKey(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "publishable",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  );
}
