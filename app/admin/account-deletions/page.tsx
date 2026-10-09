import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cardClasses } from "@/components/ui/card";
import { BackLink, DashboardHeader, DashboardShell, EmptyCard, Notice, StatusPill } from "@/components/ui/dashboard";
import { DeletionDecision } from "./forms";

export const metadata: Metadata = { title: "Account deletions — ShipMova admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const OPEN = ["submitted", "under_review", "verified"] as const;

/** Pending account-deletion requests (0069), with whether each has a deal in progress. */
export default async function AccountDeletionsPage() {
  const ctx = await requireAdmin();
  if (!ctx) redirect("/login?next=/admin/account-deletions");
  const db = createAdminClient();

  const { data: requests, error } = await db
    .from("account_deletion_requests")
    .select("id, user_id, reason, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(50);
  const userIds = (requests ?? []).map((r) => r.user_id);
  const [{ data: users }, { data: buying }, { data: cars }] = await Promise.all([
    userIds.length ? db.from("users").select("id, email, role, is_test_account").in("id", userIds) : Promise.resolve({ data: [] }),
    userIds.length ? db.from("purchase_requests").select("buyer_id").in("buyer_id", userIds).in("status", OPEN) : Promise.resolve({ data: [] }),
    userIds.length ? db.from("vehicles").select("id, seller_id").in("seller_id", userIds) : Promise.resolve({ data: [] }),
  ]);
  const carIds = (cars ?? []).map((c) => c.id);
  const { data: selling } = carIds.length
    ? await db.from("purchase_requests").select("vehicle_id").in("vehicle_id", carIds).in("status", OPEN)
    : { data: [] as { vehicle_id: string }[] };
  const sellerOfCar = new Map((cars ?? []).map((c) => [c.id, c.seller_id]));
  const openDeals = new Set<string>([
    ...(buying ?? []).map((b) => b.buyer_id),
    ...(selling ?? []).map((s) => sellerOfCar.get(s.vehicle_id)!).filter(Boolean),
  ]);
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <DashboardShell narrow>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <DashboardHeader
        className="mt-2"
        eyebrow="Admin"
        title="Account deletions"
        intro="Deleting clears personal details, archives listings and removes the sign-in. Deal and policy records are kept (Privacy Policy §8)."
      />
      {error ? (
        <Notice tone="warning" role="alert" className="mt-4">Couldn&rsquo;t load requests: {error.message}</Notice>
      ) : null}
      {(requests ?? []).length === 0 && !error ? (
        <div className="mt-6">
          <EmptyCard title="No requests">New requests also appear in Action required.</EmptyCard>
        </div>
      ) : null}
      <ul className="mt-6 flex flex-col gap-4">
        {(requests ?? []).map((r) => {
          const u = userById.get(r.user_id);
          const busy = openDeals.has(r.user_id);
          return (
            <li key={r.id} className={cardClasses()}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={busy ? "warning" : "info"}>{busy ? "Deal in progress" : "Ready to delete"}</StatusPill>
                  {u?.is_test_account ? <StatusPill>Test</StatusPill> : null}
                </div>
                <span className="text-xs text-muted">{when.format(new Date(r.requested_at))} UTC</span>
              </div>
              <p className="mt-2 break-all font-semibold text-ink">{u?.email ?? "Unknown account"}</p>
              <p className="text-sm text-muted">{u?.role ?? ""}</p>
              {r.reason ? <p className="mt-2 text-sm text-ink">&ldquo;{r.reason}&rdquo;</p> : null}
              {busy ? (
                <p className="mt-2 text-sm text-copper-700">
                  They have an open reservation. Deleting is refused until it&rsquo;s finished or released.
                </p>
              ) : null}
              <DeletionDecision requestId={r.id} />
            </li>
          );
        })}
      </ul>
    </DashboardShell>
  );
}
