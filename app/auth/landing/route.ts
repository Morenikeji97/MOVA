import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-redirect";
import { redirectToPath } from "@/lib/relative-redirect";
import { serviceAccountKind } from "@/lib/account-kind";
import { landingAfterSignIn } from "@/lib/account-dashboard";

/**
 * Where the sign-in form sends a user once they're signed in (founder,
 * 2026-10-15): their own dashboard by role — a shipper or inspector's own
 * portal, an unverified buyer to Verify your ID (lib/account-dashboard.ts)
 * — unless `next` points somewhere specific (they were sent to sign in by
 * an action like "Make an offer", or an email link), in which case that
 * page wins. Under /auth, so the policy and ID gates in middleware.ts let
 * it through.
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

  const [{ data: kind }, { data: profile }, { data: buyer }] = await Promise.all([
    supabase.rpc("my_service_account_kind"),
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("buyer_profiles").select("verification_status").eq("user_id", user.id).maybeSingle(),
  ]);

  return redirectToPath(
    landingAfterSignIn({
      role: profile?.role ?? null,
      kind: serviceAccountKind(kind),
      buyerVerified: buyer?.verification_status === "verified",
      next,
    }),
  );
}
