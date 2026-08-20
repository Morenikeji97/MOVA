import { createClient } from "@/lib/supabase/server";

export default async function SellerDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Seller Dashboard</h1>
      <p className="mt-2 text-slate-500">Signed in as {user?.email}</p>
      <p className="mt-1 font-mono text-sm text-ink-400">
        Verification status: {profile?.verification_status ?? "unverified"}
      </p>
      <p className="mt-8 text-sm text-slate-500">
        Listing creation, photo upload, and status tracking ship in Phase 1.
      </p>
    </main>
  );
}
