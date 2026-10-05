import Link from "next/link";
import { SHIPPER_FEES_ENABLED } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import { excludeIds, loadTestIds } from "@/lib/test-accounts";

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
  ] = results.map((r) => (r.error ? "—" : (r.count ?? 0)));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-black">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Counts leave out test accounts ({test.userIds.length}) and test shipper
        applications ({test.shipperIds.length}).
      </p>
      {failedCounts.length > 0 ? (
        <p className="mt-4 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Couldn&rsquo;t load: {failedCounts.join(", ")}. Those show &ldquo;—&rdquo;,
          not a real zero. Reload, and tell the developer if it persists.
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Total users
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">{userCount}</p>
        </div>
        <Link
          href="/admin/waitlist"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Waitlist signups
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">{waitlistCount}</p>
          <p className="mt-1 text-sm text-black">Open the waitlist &rarr;</p>
        </Link>
        <Link
          href="/admin/listings"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Listings pending review
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {pendingListings}
          </p>
          <p className="mt-1 text-sm text-black">Open the review queue &rarr;</p>
        </Link>
        <Link
          href="/admin/buyer-ids"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Buyer IDs to review
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">{buyerIdsToReview}</p>
          <p className="mt-1 text-sm text-black">Open the ID queue &rarr;</p>
        </Link>
        <Link
          href="/admin/reservations"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Reservation requests
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {openReservations}
          </p>
          <p className="mt-1 text-sm text-black">
            Open the reservation queue &rarr;
          </p>
        </Link>
        <Link
          href="/admin/shippers"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Shippers pending review
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {pendingShippers}
          </p>
          <p className="mt-1 text-sm text-black">Open shipper review &rarr;</p>
        </Link>
        <Link
          href="/admin/shipments"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Shipment requests
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {shipmentRequests}
          </p>
          <p className="mt-1 text-sm text-black">
            {SHIPPER_FEES_ENABLED ? <>Shipments &amp; commission &rarr;</> : <>Open shipments &rarr;</>}
          </p>
        </Link>
        <Link
          href="/admin/messages"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Blocked contact-info attempts
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {blockedMessages}
          </p>
          <p className="mt-1 text-sm text-black">Review flagged chat &rarr;</p>
        </Link>
        <Link
          href="/admin/reviews"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Reviews to moderate
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {reviewQueue}
          </p>
          <p className="mt-1 text-sm text-black">Open the moderation queue &rarr;</p>
        </Link>
        <Link
          href="/admin/disputes"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Disputes needing attention
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {openDisputes}
          </p>
          <p className="mt-1 text-sm text-black">Open the dispute queue &rarr;</p>
        </Link>
        <Link
          href="/admin/referrals"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Referrals flagged for review
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {referralAttention}
          </p>
          <p className="mt-1 text-sm text-black">
            Review flags &amp; payouts &rarr;
          </p>
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Audit log
          </p>
          <p className="mt-1 text-sm text-black">Who did what &rarr;</p>
        </Link>
        <Link
          href="/admin/security"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Two-step sign-in
          </p>
          <p className="mt-1 text-sm text-black">Manage authenticator apps &rarr;</p>
        </Link>
      </div>
    </main>
  );
}
