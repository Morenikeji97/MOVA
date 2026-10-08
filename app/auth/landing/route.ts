import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-redirect";
import { redirectToPath } from "@/lib/relative-redirect";
import { landingAfterSignIn, serviceAccountKind } from "@/lib/account-kind";

/**
 * Where the sign-in form sends a user once they're signed in: a shipper
 * login straight to its portal (lib/account-kind.ts), everyone else to
 * `next` (default: the home page). Under /auth, so the policy and ID gates
 * in middleware.ts let it through.
 *
 * Redirects are relative paths (lib/relative-redirect.ts).
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectToPath(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const { data: kind } = await supabase.rpc("my_service_account_kind");
  return redirectToPath(landingAfterSignIn(serviceAccountKind(kind), next));
}
