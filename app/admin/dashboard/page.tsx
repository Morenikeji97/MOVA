import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: userCount }, { count: pendingListings }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink-900">Admin Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-paper-200 bg-paper-100 p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
            Total users
          </p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">{userCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-paper-200 bg-paper-100 p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
            Listings pending review
          </p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">
            {pendingListings ?? 0}
          </p>
        </div>
      </div>
      <p className="mt-8 text-sm text-slate-500">
        Listing review queue, transaction management, and shipper
        applications ship across Phases 1–4.
      </p>
    </main>
  );
}
