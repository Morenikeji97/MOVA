import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TERMS_ACCEPT_PATH } from "@/lib/terms";
import { MFA_PATH, isMfaExempt } from "@/lib/admin-mfa-paths";

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
  "/auth", // prefix — /auth/callback, /auth/confirm (emailed links), /auth/link-expired
];

function isPolicyExempt(path: string): boolean {
  return POLICY_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, role, needsPolicyAcceptance, adminMfaVerified } =
    await updateSession(request);
  const path = request.nextUrl.pathname;

  // An admin account must enter an authenticator code before it can open any
  // page (lib/admin-mfa.ts). Server action requests are let through: an
  // action can be invoked by id from any page, so each admin action checks
  // the code itself (requireAdminMfa) and redirects here — a middleware
  // redirect of the action's POST would only surface as a client error.
  if (
    user &&
    role === "admin" &&
    !adminMfaVerified &&
    !isMfaExempt(path) &&
    !request.headers.has("next-action")
  ) {
    const url = new URL(MFA_PATH, request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

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

  // Canonical URL is always shipmova.com, whichever host served the page
  // (the netlify.app alias, a deploy preview), so search engines index the
  // real domain. Path only — query strings aren't part of the canonical page.
  supabaseResponse.headers.set("Link", `<${CANONICAL_ORIGIN}${path}>; rel="canonical"`);
  return supabaseResponse;
}

const CANONICAL_ORIGIN = "https://shipmova.com";

export const config = {
  matcher: [
    // Skip Stripe webhooks — they carry no session and the raw body must
    // reach the route handler untouched for signature verification.
    // Skip /media and /media-signed too: proxied Storage files (photos,
    // videos) need no session, and a video is fetched in many range requests.
    "/((?!api/stripe|media/|media-signed/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
