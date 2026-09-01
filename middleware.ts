import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_PREFIXES: { prefix: string; role: "seller" | "buyer" | "admin" }[] = [
  { prefix: "/seller", role: "seller" },
  { prefix: "/buyer", role: "buyer" },
  { prefix: "/admin", role: "admin" },
];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, role } = await updateSession(request);
  const path = request.nextUrl.pathname;

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
