import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  WAITLIST_AUDIENCE_LABEL,
  WAITLIST_AUDIENCES,
  WAITLIST_COUNTRIES,
  type WaitlistAudience,
} from "@/lib/prelaunch";
import { requireAdminMfa } from "@/lib/admin-mfa";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

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
  home: "Homepage",
  how_it_works: "How it works",
  browse: "Browse",
  sell: "Sell page",
  shipper: "Shipper page",
  inspectors: "Inspectors page",
  clearing_agents: "Clearing agents page",
};

const isAudience = (v: unknown): v is WaitlistAudience =>
  (WAITLIST_AUDIENCES as readonly string[]).includes(v as string);

/**
 * Waitlist, newest first, filterable by audience (?audience=inspector).
 * Reads with the admin's own session: the "waitlist admin read" RLS policy
 * is what lets these rows through, so the role check here is only for a
 * friendly 404.
 */
export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const { audience: rawAudience } = await searchParams;
  const audience = isAudience(rawAudience) ? rawAudience : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") notFound();
  await requireAdminMfa(supabase);

  let query = supabase
    .from("waitlist_signups")
    .select(
      "id, email, whatsapp, country, vehicle_id, source, audience, full_name, company, city_state, experience, ports_served, license_number, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (audience) query = query.eq("audience", audience);
  const { data: rows, count } = await query;

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: "/admin/waitlist", active: audience === null },
    ...WAITLIST_AUDIENCES.map((a) => ({
      label: WAITLIST_AUDIENCE_LABEL[a],
      href: `/admin/waitlist?audience=${a}`,
      active: audience === a,
    })),
  ];

  return (
    <DashboardShell>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">Waitlist</h1>

      <nav aria-label="Filter by audience" className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              f.active ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <p className="mt-3 text-sm text-muted">
        {count ?? 0} signup{count === 1 ? "" : "s"}
        {audience ? ` · ${WAITLIST_AUDIENCE_LABEL[audience]}` : ""}
        {(count ?? 0) > 500 ? " — showing the newest 500" : ""}.
      </p>

      {(rows ?? []).length === 0 ? (
        <p className="mt-8 text-muted">No signups{audience ? " for this audience" : ""} yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-white shadow-card">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {r.full_name ? (
                  <p className="font-medium text-ink">
                    {r.full_name}
                    {r.company ? <span className="font-normal text-muted"> · {r.company}</span> : null}
                  </p>
                ) : null}
                <p className="truncate text-ink">{r.email ?? "—"}</p>
                <p className="font-mono text-sm text-muted">{r.whatsapp ?? "No WhatsApp"}</p>
                {r.city_state ? <p className="text-sm text-muted">{r.city_state}</p> : null}
                {r.ports_served?.length ? (
                  <p className="text-sm text-muted">Ports: {r.ports_served.join(", ")}</p>
                ) : null}
                {r.license_number ? (
                  <p className="text-sm text-muted">License / CAC: {r.license_number}</p>
                ) : null}
                {r.experience ? (
                  <p className="mt-1 max-w-prose whitespace-pre-line text-sm text-ink">{r.experience}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-sm text-muted sm:text-right">
                <p>
                  <span className="font-medium text-ink">
                    {WAITLIST_AUDIENCE_LABEL[r.audience as WaitlistAudience] ?? r.audience}
                  </span>
                  {" · "}
                  {COUNTRY_NAME.get(r.country) ?? r.country} · {SOURCE_LABEL[r.source] ?? r.source}
                  {r.vehicle_id ? (
                    <>
                      {" · "}
                      <Link href={`/browse/${r.vehicle_id}`} className="text-ink underline">
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
    </DashboardShell>
  );
}
