import { createClient } from "@/lib/supabase/server";

export default async function BuyerDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("buyer_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  const profile = data as { nin_verification_status?: string } | null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Buyer Dashboard</h1>
      <p className="mt-2 text-slate-500">Signed in as {user?.email}</p>
      <p className="mt-1 font-mono text-sm text-ink-400">
        NIN verification: {profile?.nin_verification_status ?? "unverified"}
      </p>
      <p className="mt-8 text-sm text-slate-500">
        Browse, favorites, and purchase requests ship in Phase 2–4.
      </p>
    </main>
  );
}
