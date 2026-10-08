import Link from "next/link";
import { SHIPPER_FEES_ENABLED } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import { excludeIds, loadTestIds } from "@/lib/test-accounts";
import { DashboardHeader, DashboardShell, DashboardTile, Notice } from "@/components/ui/dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { loadActionItems } from "@/lib/action-required-load";
import { rankActions } from "@/lib/action-required";
import { cn } from "@/lib/utils";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Test logins and test shipper applications (migration 0054) are left out
  // of every count below.
  const test = await loadTestIds(supabase);
  const u = test.userIds;

  const results = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("is_test_account", false),
    excludeIds(
      supabase
        .from("vehicles")
        // Not "*": vin and the document paths aren't readable with the anon
        // key (migration 0037), so a star select on vehicles is refused.
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      "seller_id",
      u,
    ),
    excludeIds(
      supabase
        .from("purchase_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "verified"]),
      "buyer_id",
      u,
    ),
    supabase
      .from("shippers")
      // Not "*": the Stripe token columns aren't granted (0016), so a star
      // select is refused and the count silently came back empty (0).
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("is_test", false),
    excludeIds(
      excludeIds(
        supabase.from("shipment_requests").select("id", { count: "exact", head: true }),
        "buyer_id",
        u,
      ),
      "shipper_id",
      test.shipperIds,
    ),
    excludeIds(
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("blocked_attempt", true),
      "sender_id",
      u,
    ),
    excludeIds(
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "flagged"]),
      "reviewer_id",
      u,
    ),
    excludeIds(
      supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "approved_pending_refund"]),
      "reporter_id",
      u,
    ),
    excludeIds(
      supabase
        .from("referral_credits")
        .select("id", { count: "exact", head: true })
        .eq("flag_status", "flagged")
        .is("flag_reviewed_at", null),
      "referrer_id",
      u,
    ),
    supabase.from("waitlist_signups").select("id", { count: "exact", head: true }),
    excludeIds(
      supabase
        .from("buyer_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("verification_status", "pending")
        .not("id_method", "is", null),
      "user_id",
      u,
    ),
    excludeIds(
      supabase.from("inspectors").select("id", { count: "exact", head: true }).eq("status", "pending"),
      "user_id",
      u,
    ),
  ]);

  // A failed count must never read as 0 ("nothing pending"): show "—" and say
  // which counts didn't load.
  const COUNT_LABELS = [
    "Total users",
    "Listings pending review",
    "Reservation requests",
    "Shippers pending review",
    "Shipment requests",
    "Blocked messages",
    "Reviews to moderate",
    "Open disputes",
    "Referral flags",
    "Waitlist signups",
    "Buyer IDs to review",
    "Inspector applications",
  ];
  const failedCounts = results.flatMap((r, i) => {
    if (!r.error) return [];
    console.error(`admin dashboard: "${COUNT_LABELS[i]}" count failed:`, r.error);
    return [COUNT_LABELS[i]];
  });
  const [
    userCount,
    pendingListings,
    openReservations,
    pendingShippers,
    shipmentRequests,
    blockedMessages,
    reviewQueue,
    openDisputes,
    referralAttention,
    waitlistCount,
    buyerIdsToReview,
    inspectorApplications,
  ] = results.map((r) => (r.error ? "—" : (r.count ?? 0)));

  // Action required (admin with the authenticator code; service-role read).
  const action = (await requireAdmin()) ? await loadActionItems() : null;
  const realItems = action ? rankActions(action.items.filter((i) => !i.test), new Date()) : [];
  const overdue = realItems.filter((i) => i.overdue).length;

  const QUEUES: { href: string; title: string; count: number | string; body: string }[] = [
    { href: "/admin/listings", title: "Listings", count: pendingListings, body: "pending review" },
    { href: "/admin/buyer-ids", title: "Buyer IDs", count: buyerIdsToReview, body: "to check" },
    { href: "/admin/reservations", title: "Reservations", count: openReservations, body: "open requests" },
    { href: "/admin/shipments", title: "Shipments", count: shipmentRequests, body: SHIPPER_FEES_ENABLED ? "shipments & commission" : "all shipments" },
    { href: "/admin/shippers", title: "Shippers", count: pendingShippers, body: "applications pending" },
    { href: "/admin/inspectors", title: "Inspectors", count: inspectorApplications, body: "applications pending" },
    { href: "/admin/disputes", title: "Disputes", count: openDisputes, body: "need attention" },
    { href: "/admin/reviews", title: "Reviews", count: reviewQueue, body: "to moderate" },
    { href: "/admin/messages", title: "Blocked chat", count: blockedMessages, body: "contact-info attempts" },
    { href: "/admin/referrals", title: "Referrals", count: referralAttention, body: "flags & payouts" },
    { href: "/admin/waitlist", title: "Waitlist", count: waitlistCount, body: "signups" },
  ];

  return (
    <DashboardShell>
      <DashboardHeader
        eyebrow="Admin"
        title="Dashboard"
        intro={`${userCount} users. Counts leave out test accounts (${test.userIds.length}) and test shipper applications (${test.shipperIds.length}).`}
      />
      {failedCounts.length > 0 ? (
        <Notice tone="warning" role="alert" className="mt-4">
          Couldn&rsquo;t load: {failedCounts.join(", ")}. Those show &ldquo;—&rdquo;, not a real zero.
          Reload, and tell the developer if it persists.
        </Notice>
      ) : null}

      {/* The one place to start the day: everything waiting on staff. */}
      <Link
        href="/admin/action-required"
        className={cn(
          "mt-6 flex items-center justify-between gap-4 rounded-card p-5 shadow-card transition-colors",
          realItems.length > 0 ? "bg-ink text-white hover:bg-neutral-800" : "border border-line bg-white text-ink hover:border-ink",
        )}
      >
        <span className="min-w-0">
          <span className="block font-display text-2xl font-extrabold">Action required</span>
          <span className={cn("mt-1 block text-sm", realItems.length > 0 ? "text-white/80" : "text-muted")}>
            {!action
              ? "Open the queue"
              : action.failed.length > 0
                ? `Some sources didn't load (${action.failed.join(", ")}) — open to see the rest`
                : realItems.length === 0
                  ? "Nothing is waiting on you"
                  : `${realItems.length} item${realItems.length === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue` : ""}`}
          </span>
        </span>
        <span aria-hidden className="text-3xl">
          &rsaquo;
        </span>
      </Link>

      <h2 className="mt-8 font-display text-xl font-bold text-ink">Queues</h2>
      <nav aria-label="Admin queues" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUEUES.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="flex min-h-[6rem] flex-col justify-between rounded-card border border-line bg-white p-4 shadow-card transition-colors hover:border-ink"
          >
            <span className="text-sm font-semibold text-ink">{q.title}</span>
            <span>
              <span className="block font-display text-3xl font-extrabold tabular-nums text-ink">{q.count}</span>
              <span className="block text-xs text-muted">{q.body}</span>
            </span>
          </Link>
        ))}
      </nav>

      <h2 className="mt-8 font-display text-xl font-bold text-ink">Records &amp; security</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DashboardTile href="/admin/audit" title="Audit log" body="Who did what" />
        <DashboardTile href="/admin/security" title="Two-step sign-in" body="Manage authenticator apps" />
      </div>
    </DashboardShell>
  );
}
