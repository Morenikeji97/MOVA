import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InspectorApplicationForm } from "../inspections/forms";

export const dynamic = "force-dynamic";

/** Inspector applications and approved inspectors (0063). Read through RLS (admin). */
export default async function AdminInspectorsPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("inspectors")
    .select("id, user_id, full_name, phone, service_states, status, rejection_reason, is_test, created_at")
    .order("created_at", { ascending: true })
    .limit(100);
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: users } = ids.length ? await supabase.from("users").select("id, email").in("id", ids) : { data: [] };
  const groups = [
    { title: "Applications", list: (rows ?? []).filter((r) => r.status === "pending") },
    { title: "Approved", list: (rows ?? []).filter((r) => r.status === "approved") },
    { title: "Suspended or rejected", list: (rows ?? []).filter((r) => r.status === "suspended" || r.status === "rejected") },
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/admin/dashboard" className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black">
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">Inspectors</h1>
      {error ? <p className="mt-4 text-sm text-copper-700">Couldn&rsquo;t load inspectors: {error.message}</p> : null}
      {groups.map((g) => (
        <section key={g.title} className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
            {g.title} ({g.list.length})
          </h2>
          {g.list.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">None.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {g.list.map((r) => (
                <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="font-medium text-black">
                    {r.full_name}
                    {r.is_test ? <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">TEST</span> : null}
                  </p>
                  <p className="mt-1 break-all text-sm text-gray-500">
                    {users?.find((u) => u.id === r.user_id)?.email} · {r.phone}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">States: {r.service_states.join(", ") || "—"}</p>
                  {r.rejection_reason ? <p className="mt-1 text-sm text-copper-700">{r.rejection_reason}</p> : null}
                  {r.status !== "rejected" ? <InspectorApplicationForm inspectorId={r.id} approved={r.status === "approved"} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
