import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { VerificationPanel } from "../verification/verification-panel";

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const { verification } = await searchParams;
  const notice =
    verification === "complete"
      ? "complete"
      : verification === "error"
        ? "error"
        : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  const profile = data;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Seller Dashboard</h1>
      <p className="mt-2 text-slate-500">Signed in as {user?.email}</p>
      <p className="mt-1 font-mono text-sm text-ink-400">
        Verification status: {profile?.verification_status ?? "unverified"}
      </p>
      <div className="mt-8 flex flex-col items-start gap-3">
        <Link href="/seller/listings" className={buttonClasses({ size: "sm" })}>
          My listings
        </Link>
        <p className="text-sm text-slate-500">
          Photo upload and richer status tracking arrive later in Phase 1.
        </p>
      </div>

      <VerificationPanel
        status={profile?.id_verification_status ?? null}
        verifiedAt={profile?.id_verified_at ?? null}
        notice={notice}
      />
    </main>
  );
}
