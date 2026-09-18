"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export type AcceptTermsResult = { ok: true } | { ok: false; error: string };

/** Same-origin-only redirect target — never trust `next` past this shape. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

/**
 * Records the mandatory Terms & Conditions acceptance (public.terms_acceptances,
 * context = 'login_gate') before releasing the user back to whatever page the
 * middleware gate originally redirected them from. Independent of
 * acceptFeePaymentPolicy/policy_acceptances (Buyer Protection Policy) in
 * app/buyer/dashboard/actions.ts — a user needs both, not one instead of the
 * other.
 *
 * ip_address/user_agent are read from the request itself, never trusted from
 * the client. accepted_at and role are likewise forced server-side by the
 * terms_acceptances_guard trigger (migration 0027) regardless of what's sent
 * here.
 */
export async function acceptTerms(next: string | null): Promise<AcceptTermsResult> {
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

  const { error } = await supabase.from("terms_acceptances").insert({
    user_id: user.id,
    context: "login_gate",
    version: CURRENT_TERMS_VERSION,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    console.error("acceptTerms insert failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  redirect(safeNext(next));
}
