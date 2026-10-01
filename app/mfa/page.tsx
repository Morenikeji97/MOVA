import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasMfaSession } from "@/lib/admin-mfa";
import { ROLE_HOME, safeNextPath } from "@/lib/auth-redirect";
import { MfaGate } from "./mfa-gate";

export const metadata: Metadata = {
  title: "Two-step sign-in — ShipMova",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Where middleware.ts sends an admin whose session hasn't passed the
 * authenticator-code step (lib/admin-mfa.ts): set up an authenticator app
 * if the account has none yet, otherwise enter a code.
 */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const destination = next && next !== "/" ? next : ROLE_HOME.admin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mfa");

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/");

  if (await hasMfaSession(supabase)) redirect(destination);

  const hasAuthenticator = (user.factors ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <MfaGate mode={hasAuthenticator ? "verify" : "enroll"} destination={destination} />
    </main>
  );
}
