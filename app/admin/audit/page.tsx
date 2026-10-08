import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/**
 * The admin audit log (migration 0056): who did what, newest first. Read
 * through RLS ("admin audit log admin read" → is_admin(), code-checked), so
 * nothing is shown to anyone else. Append-only — there's nothing to edit.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const before = typeof sp.before === "string" && /^\d+$/.test(sp.before) ? Number(sp.before) : null;

  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_log")
    .select("id, seq, admin_id, action, target_table, target_id, details, created_at")
    .order("seq", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) query = query.lt("seq", before);
  const { data: rows, error } = await query;

  const adminIds = [...new Set((rows ?? []).map((r) => r.admin_id))];
  const { data: admins } = adminIds.length
    ? await supabase.from("users").select("id, email").in("id", adminIds)
    : { data: [] };
  const emailById = new Map((admins ?? []).map((a) => [a.id, a.email]));
  const last = rows && rows.length === PAGE_SIZE ? rows[rows.length - 1].seq : null;

  return (
    <DashboardShell narrow>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">Audit log</h1>
      <p className="mt-2 text-sm text-muted">
        Every admin action, newest first. Entries can&rsquo;t be edited or deleted. Times in UTC.
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Couldn&rsquo;t load the audit log: {error.message}
        </p>
      ) : !rows || rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          No admin actions recorded yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => {
            const details = Object.entries(r.details ?? {}).filter(([, v]) => v !== null && v !== "");
            return (
              <li key={r.id} className="rounded-card border border-line bg-white shadow-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm font-medium text-ink">{r.action}</p>
                  <p className="font-mono text-xs text-muted">{when.format(new Date(r.created_at))}</p>
                </div>
                <p className="mt-1 break-all text-sm text-muted">
                  {emailById.get(r.admin_id) ?? r.admin_id} · {r.target_table}
                  {r.target_id ? ` ${r.target_id.slice(0, 8)}` : ""}
                </p>
                {details.length > 0 ? (
                  <dl className="mt-2 flex flex-col gap-0.5 text-sm">
                    {details.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="shrink-0 text-muted">{k.replace(/_/g, " ")}</dt>
                        <dd className="break-all text-ink">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {last ? (
        <Link
          href={`/admin/audit?before=${last}`}
          className="mt-6 inline-flex h-11 items-center rounded-lg border border-ink px-5 text-ink"
        >
          Older entries &rarr;
        </Link>
      ) : null}
    </DashboardShell>
  );
}
