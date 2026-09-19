"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { CURRENT_PRIVACY_VERSION } from "@/lib/privacy";

export type AcceptPoliciesResult = { ok: true } | { ok: false; error: string };

/** Same-origin-only redirect target — never trust `next` past this shape. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

/**
 * Records whichever of the two mandatory legal-document acceptances
 * (public.terms_acceptances, public.privacy_policy_acceptances — both
 * context = 'login_gate') the signed-in user is still missing at the
 * current version, then releases them back to whatever page the middleware
 * gate originally redirected them from. Independent of
 * acceptFeePaymentPolicy/policy_acceptances (Buyer Protection Policy) in
 * app/buyer/dashboard/actions.ts — a user needs all of these, not one
 * instead of the others.
 *
 * Re-derives "which ones are still missing" from the DB itself rather than
 * trusting which checkboxes the client says were ticked — makes this
 * idempotent against a double-submit and correct even if a user was only
 * ever missing one of the two (e.g. they accepted Terms before the Privacy
 * Policy gate existed).
 *
 * ip_address/user_agent are read from the request itself, never trusted
 * from the client. accepted_at and role are likewise forced server-side by
 * each table's own guard trigger (migrations 0027/0028) regardless of what
 * is sent here.
 */
export async function acceptPolicies(next: string | null): Promise<AcceptPoliciesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in and try again." };
  }

  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent");

  const [{ data: termsAcceptance }, { data: privacyAcceptance }] = await Promise.all([
    supabase
      .from("terms_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("version", CURRENT_TERMS_VERSION)
      .maybeSingle(),
    supabase
      .from("privacy_policy_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("version", CURRENT_PRIVACY_VERSION)
      .maybeSingle(),
  ]);

  if (!termsAcceptance) {
    const { error } = await supabase.from("terms_acceptances").insert({
      user_id: user.id,
      context: "login_gate",
      version: CURRENT_TERMS_VERSION,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    if (error) {
      console.error("acceptPolicies terms insert failed:", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  if (!privacyAcceptance) {
    const { error } = await supabase.from("privacy_policy_acceptances").insert({
      user_id: user.id,
      context: "login_gate",
      version: CURRENT_PRIVACY_VERSION,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    if (error) {
      console.error("acceptPolicies privacy insert failed:", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  redirect(safeNext(next));
}
