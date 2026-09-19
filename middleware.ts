import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TERMS_ACCEPT_PATH } from "@/lib/terms";

const ROLE_PREFIXES: { prefix: string; role: "seller" | "buyer" | "admin" }[] = [
  { prefix: "/seller", role: "seller" },
  { prefix: "/buyer", role: "buyer" },
  { prefix: "/admin", role: "admin" },
];

// Paths that must stay reachable for a signed-in user who hasn't accepted
// the current Terms & Conditions and Privacy Policy yet — everything else
// is blocked, by design (see supabase/migrations/0027_terms_and_conditions.sql,
// 0028_privacy_policy_acceptance.sql, and the mandatory-terms-acceptance
// plan). Exact-match, except the two marked prefixes.
const POLICY_EXEMPT_PATHS = [
  TERMS_ACCEPT_PATH,
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/shipper/signup", // prefix — also covers /shipper/signup/success
  "/auth/callback", // prefix — covers the route handler and any sub-paths
];

function isPolicyExempt(path: string): boolean {
  return POLICY_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, role, needsPolicyAcceptance } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (user && needsPolicyAcceptance && !isPolicyExempt(path)) {
    const url = new URL(TERMS_ACCEPT_PATH, request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const match = ROLE_PREFIXES.find((r) => path.startsWith(r.prefix));
  if (match) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
    if (role !== match.role) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Stripe webhooks — they carry no session and the raw body must
    // reach the route handler untouched for signature verification.
    "/((?!api/stripe|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
