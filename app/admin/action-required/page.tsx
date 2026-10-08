import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { ACTION_GROUPS, rankActions, waitedLabel } from "@/lib/action-required";
import { loadActionItems } from "@/lib/action-required-load";
import { BackLink, DashboardHeader, DashboardShell, EmptyCard, Notice, StatusPill } from "@/components/ui/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Action required — ShipMova admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Everything waiting on ShipMova staff, on one phone screen (lib/action-required.ts
 * has the rules). Read-only: each item links to the screen where it's done,
 * which is where the action, its checks and its audit-log entry already live.
 * Test accounts and test applications are left out unless ?tests=1.
 */
export default async function ActionRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ tests?: string }>;
}) {
  const ctx = await requireAdmin();
  if (!ctx) redirect("/login?next=/admin/action-required");
  const showTests = (await searchParams).tests === "1";

  const { items, failed } = await loadActionItems();
  const now = new Date();

  const hiddenTests = items.filter((i) => i.test).length;
  const ranked = rankActions(showTests ? items : items.filter((i) => !i.test), now);
  const overdueCount = ranked.filter((r) => r.overdue).length;
  const groups = ACTION_GROUPS.map((g) => ({ ...g, items: ranked.filter((r) => r.group === g.group) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <DashboardShell narrow>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <DashboardHeader
        className="mt-2"
        eyebrow="Admin"
        title="Action required"
        intro={
          ranked.length === 0
            ? "Nothing is waiting on you."
            : `${ranked.length} item${ranked.length === 1 ? "" : "s"}${overdueCount ? ` · ${overdueCount} overdue` : ""}. Oldest and overdue first.`
        }
      />

      {failed.length > 0 ? (
        <Notice tone="warning" role="alert" className="mt-4">
          Couldn&rsquo;t load: {failed.join(", ")}. Those may have items this page isn&rsquo;t showing. Reload,
          and tell the developer if it persists.
        </Notice>
      ) : null}

      {/* Jump links, one per group with items. */}
      {groups.length > 1 ? (
        <nav aria-label="Groups" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {groups.map((g) => (
            <a
              key={g.group}
              href={`#${g.group}`}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink"
            >
              {g.label}
              <span className="rounded-full bg-band px-2 text-xs tabular-nums">{g.items.length}</span>
            </a>
          ))}
        </nav>
      ) : null}

      {ranked.length === 0 && failed.length === 0 ? (
        <div className="mt-6">
          <EmptyCard title="All clear">New items appear here as soon as something needs you.</EmptyCard>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.group} id={g.group} className="mt-6 scroll-mt-4">
          <h2 className="font-display text-lg font-bold text-ink">
            {g.label} <span className="text-muted">({g.items.length})</span>
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {g.items.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className={cn(
                    "flex min-h-[4rem] items-center justify-between gap-3 rounded-card border bg-white p-4 shadow-card transition-colors hover:border-ink",
                    r.overdue ? "border-copper-400" : "border-line",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{r.title}</span>
                    {r.detail ? <span className="mt-0.5 block truncate text-sm text-muted">{r.detail}</span> : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {r.overdue ? <StatusPill tone="warning">Overdue</StatusPill> : null}
                    {r.test ? <StatusPill>Test</StatusPill> : null}
                    <span className="text-xs tabular-nums text-muted">{waitedLabel(r.ageHours)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-sm text-muted">
        {showTests ? (
          <>
            Showing test accounts and applications.{" "}
            <Link href="/admin/action-required" className="font-semibold text-ink underline underline-offset-2">
              Hide them
            </Link>
          </>
        ) : (
          <>
            {hiddenTests} test item{hiddenTests === 1 ? "" : "s"} hidden.{" "}
            <Link href="/admin/action-required?tests=1" className="font-semibold text-ink underline underline-offset-2">
              Show them
            </Link>
          </>
        )}
      </p>
    </DashboardShell>
  );
}
