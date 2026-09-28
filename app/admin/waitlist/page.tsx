import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_COUNTRIES } from "@/lib/prelaunch";

const joined = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const COUNTRY_NAME = new Map<string, string>(WAITLIST_COUNTRIES.map((c) => [c.code, c.name]));

const SOURCE_LABEL: Record<string, string> = {
  site: "Site",
  listing: "Listing page",
  dashboard: "Buyer dashboard",
};

/**
 * Pre-launch waitlist, newest first. Reads with the admin's own session:
 * the "waitlist admin read" RLS policy is what lets these rows through, so
 * the role check here is only for a friendly 404.
 */
export default async function AdminWaitlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") notFound();

  const { data: rows, count } = await supabase
    .from("waitlist_signups")
    .select("id, email, whatsapp, country, vehicle_id, source, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">Waitlist</h1>
      <p className="mt-1 text-sm text-gray-500">
        {count ?? 0} signup{count === 1 ? "" : "s"}
        {(count ?? 0) > 500 ? " — showing the newest 500" : ""}.
      </p>

      {(rows ?? []).length === 0 ? (
        <p className="mt-8 text-gray-500">No one has joined yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-black">{r.email ?? "—"}</p>
                <p className="font-mono text-sm text-gray-500">{r.whatsapp ?? "No WhatsApp"}</p>
              </div>
              <div className="text-sm text-gray-500 sm:text-right">
                <p>
                  {COUNTRY_NAME.get(r.country) ?? r.country} · {SOURCE_LABEL[r.source] ?? r.source}
                  {r.vehicle_id ? (
                    <>
                      {" · "}
                      <Link href={`/browse/${r.vehicle_id}`} className="text-black underline">
                        listing
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className="font-mono text-xs">{joined.format(new Date(r.created_at))}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
