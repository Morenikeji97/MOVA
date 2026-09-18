import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { CookieOptions } from "@supabase/ssr";
import { assertSupabaseKey } from "@/lib/supabase/keys";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // NEXT_PUBLIC_SUPABASE_ANON_KEY holds a new-format publishable key
  // (`sb_publishable_…`) — see lib/supabase/client.ts.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    assertSupabaseKey(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "publishable",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
          headers: Record<string, string>
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // @supabase/ssr passes cache-control headers here so that responses
          // carrying refreshed auth cookies are never cached by a CDN/proxy.
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "seller" | "buyer" | "admin" | null = null;
  // Mandatory Terms & Conditions gate — every non-admin authenticated
  // account (buyer, seller, or a shipper, who is always a plain buyer/seller
  // -role account underneath: see claimShipper() in app/shipper/actions.ts)
  // must have a public.terms_acceptances row for CURRENT_TERMS_VERSION.
  // Independent from the Buyer Protection Policy's own acceptance flow.
  let needsTerms = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;

    if (role && role !== "admin") {
      const { data: acceptance } = await supabase
        .from("terms_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", CURRENT_TERMS_VERSION)
        .maybeSingle();
      needsTerms = !acceptance;
    }
  }

  return { supabaseResponse, user, role, needsTerms };
}
