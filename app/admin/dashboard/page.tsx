import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: pendingListings },
    { count: openReservations },
    { count: pendingShippers },
    { count: shipmentRequests },
    { count: blockedMessages },
    { count: reviewQueue },
    { count: openDisputes },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("purchase_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "under_review", "verified"]),
    supabase
      .from("shippers")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("shipment_requests")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("blocked_attempt", true),
    supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "flagged"]),
    supabase
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "approved_pending_refund"]),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-black">Admin Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Total users
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">{userCount ?? 0}</p>
        </div>
        <Link
          href="/admin/listings"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Listings pending review
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {pendingListings ?? 0}
          </p>
          <p className="mt-1 text-sm text-black">Open the review queue &rarr;</p>
        </Link>
        <Link
          href="/admin/reservations"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-black"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Reservation requests
          </p>
          <p className="mt-1 text-3xl font-semibold text-black">
            {openReservations ?? 0}
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
            {pendingShippers ?? 0}
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
            {shipmentRequests ?? 0}
          </p>
          <p className="mt-1 text-sm text-black">
            Shipments &amp; commission &rarr;
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
            {blockedMessages ?? 0}
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
            {reviewQueue ?? 0}
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
            {openDisputes ?? 0}
          </p>
          <p className="mt-1 text-sm text-black">Open the dispute queue &rarr;</p>
        </Link>
      </div>
    </main>
  );
}
