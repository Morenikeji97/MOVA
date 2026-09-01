"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/** App origin for Stripe's return_url. Prefers NEXT_PUBLIC_APP_URL, else the request host. */
async function appUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Start (or restart) Stripe Identity verification for the current seller.
 *
 * Creates a hosted VerificationSession, records it on the seller's profile as
 * 'pending', and redirects to Stripe. The actual pass/fail result arrives
 * later via the webhook at /api/stripe/identity/webhook.
 *
 * Bound to <form action={startIdentityVerification}> on the seller dashboard.
 * Failures redirect back with ?verification=error rather than throwing at the
 * user.
 */
export async function startIdentityVerification(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/seller/dashboard");

  const { data: account } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (account?.role !== "seller") redirect("/");

  const { data: profile } = await supabase
    .from("seller_profiles")
    .select("id_verification_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.id_verification_status === "verified") {
    redirect("/seller/dashboard");
  }

  let redirectUrl: string | null = null;
  try {
    const session = await getStripe().identity.verificationSessions.create({
      type: "document",
      metadata: { user_id: user.id },
      return_url: `${await appUrl()}/seller/dashboard?verification=complete`,
    });
    redirectUrl = session.url ?? null;

    const { error } = await supabase.from("seller_profiles").upsert(
      {
        user_id: user.id,
        id_verification_status: "pending",
        id_verification_provider_ref: session.id,
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  } catch (err) {
    console.error("Stripe Identity start failed:", err);
    redirect("/seller/dashboard?verification=error");
  }

  if (!redirectUrl) redirect("/seller/dashboard?verification=error");
  redirect(redirectUrl);
}
