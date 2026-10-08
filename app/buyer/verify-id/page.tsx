import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-redirect";
import { VerifyIdForm } from "./verify-id-form";
import { AuthShell } from "@/components/ui/auth-shell";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { isIdVerificationLive } from "@/lib/id-verification";

export const metadata: Metadata = {
  title: "Verify your ID — ShipMova",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * The buyer's required ID step (lib/id-verification.ts). middleware.ts sends
 * every unverified buyer here; the account isn't usable until it passes.
 */
export default async function VerifyIdPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/buyer/verify-id");

  const { data: profile } = await supabase
    .from("buyer_profiles")
    .select("verification_status, id_country, id_review_note")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.verification_status === "verified") {
    redirect(next && next !== "/buyer/verify-id" ? next : "/browse");
  }

  return (
    <AuthShell wide>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-band text-ink">
        <ShieldCheckIcon size={22} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">Verify your ID</h1>
      <p className="mt-2 text-muted">
        Every ShipMova buyer verifies their ID once, before using their account. It keeps
        sellers and other buyers safe. No selfie needed.
      </p>

      {profile?.verification_status === "pending" ? (
        <div className="mt-6 rounded-lg border border-marine-700/30 bg-marine-50 p-4 text-marine-700">
          <p className="font-semibold">ShipMova is checking your ID</p>
          <p className="mt-1 text-sm">
            We&rsquo;ll email you when it&rsquo;s done, usually within a day. Your account opens
            as soon as it&rsquo;s approved.
          </p>
        </div>
      ) : (
        <>
          {profile?.id_review_note ? (
            <p className="mt-6 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
              Your last ID check wasn&rsquo;t accepted: {profile.id_review_note}. Please try again.
            </p>
          ) : null}
          <VerifyIdForm
            userId={user.id}
            defaultCountry={profile?.id_country ?? null}
            live={isIdVerificationLive()}
          />
        </>
      )}
    </AuthShell>
  );
}
