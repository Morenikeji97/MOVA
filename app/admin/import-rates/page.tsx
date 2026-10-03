import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMfa } from "@/lib/admin-mfa";
import { fractionToPercentText, RATE_FIELDS } from "@/lib/landed-cost";
import { RatesForm } from "./rates-form";
import { STALE_AFTER_DAYS } from "@/lib/import-rates";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Staff page for the Nigerian import rates behind the listing page's
 * landed-cost estimate. Mobile-first: one column of fields, big inputs.
 */
export default async function AdminImportRatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") notFound();
  await requireAdminMfa(supabase);

  const { data: row } = await supabase
    .from("import_rates")
    .select("*")
    .eq("country", "NG")
    .maybeSingle();

  const { data: history } = await supabase
    .from("admin_actions_log")
    .select("id, notes, created_at")
    .eq("target_table", "import_rates")
    .order("created_at", { ascending: false })
    .limit(10);

  const initial: Record<string, string> = {};
  if (row) {
    for (const f of RATE_FIELDS) {
      initial[f.name] =
        f.kind === "percent" ? fractionToPercentText(row[f.name]) : String(Number(row[f.name]));
    }
  }
  const ageDays = row
    ? Math.floor((Date.now() - new Date(row.last_verified_at).getTime()) / 86_400_000)
    : null;
  const stale = ageDays !== null && ageDays > STALE_AFTER_DAYS;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/admin/dashboard" className="inline-flex h-11 items-center text-sm text-gray-500">
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-black">Nigeria import rates</h1>
      <p className="mt-2 text-sm text-gray-500">
        These drive the &ldquo;Estimated landed in Lagos&rdquo; figure on every listing.
        Confirm them with a clearing agent at least monthly, and whenever Customs
        announces a change.
      </p>

      {row ? (
        <>
          <p
            className={
              stale
                ? "mt-4 rounded bg-red-50 p-3 text-sm font-medium text-red-700"
                : "mt-4 rounded bg-gray-50 p-3 text-sm text-gray-700"
            }
          >
            Last checked {dateFmt.format(new Date(row.last_verified_at))}
            {ageDays !== null ? ` (${ageDays} day${ageDays === 1 ? "" : "s"} ago)` : ""}
            {stale ? " — due for a re-check" : ""}
          </p>
          <RatesForm initial={initial} sourceNote={row.source_note ?? ""} />
        </>
      ) : (
        <p className="mt-6 text-sm text-red-700">
          The rates table is empty. Run migration 0051 to seed it.
        </p>
      )}

      {history && history.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-black">History</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.id} className="rounded border border-gray-200 bg-white p-3 text-sm">
                <p className="font-mono text-xs text-gray-500">
                  {dateFmt.format(new Date(h.created_at))}
                </p>
                <p className="mt-1 break-words text-gray-700">{h.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
