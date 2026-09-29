import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  destinationAfterConfirm,
  isEmailLinkType,
  LINK_EXPIRED_PATH,
} from "@/lib/auth-redirect";

/**
 * Landing route for every MOVA auth email (supabase/email-templates/):
 *   /auth/confirm?token_hash=…&type=email|recovery|magiclink|invite|email_change&next=…
 *
 * Verifies the one-time token on this site (so the user never passes
 * through a supabase.co address), which signs them in via the session
 * cookie, then sends them on — see lib/auth-redirect.ts for where. An
 * expired, reused or malformed link goes to /auth/link-expired.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  const fail = (reason: string) => {
    const dest = new URL(LINK_EXPIRED_PATH, request.url);
    dest.searchParams.set("reason", reason);
    if (isEmailLinkType(type)) dest.searchParams.set("type", type);
    return NextResponse.redirect(dest);
  };

  if (!tokenHash || !isEmailLinkType(type)) return fail("invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    console.error("auth/confirm: verifyOtp failed", error?.message);
    return fail("expired");
  }

  const [{ data: profile }, { data: shipper }] = await Promise.all([
    supabase.from("users").select("role").eq("id", data.user.id).maybeSingle(),
    supabase.from("shippers").select("id").eq("user_id", data.user.id).maybeSingle(),
  ]);

  const dest = destinationAfterConfirm({
    type,
    next,
    role: profile?.role ?? null,
    isShipper: Boolean(shipper),
  });
  return NextResponse.redirect(new URL(dest, request.url));
}
