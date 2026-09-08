import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { assertSupabaseKey } from "./keys";

// NEXT_PUBLIC_SUPABASE_ANON_KEY holds a new-format Supabase publishable key
// (`sb_publishable_…`) — see lib/supabase/client.ts. User auth still flows
// through the request cookies; the key only carries anon-level privilege.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    assertSupabaseKey(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "publishable",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore since
            // middleware.ts refreshes the session.
          }
        },
      },
    }
  );
}
