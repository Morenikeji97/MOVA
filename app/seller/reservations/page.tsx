import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReportIssuePanel } from "@/components/ui/report-issue-panel";
import { DisputeStatusList, type DisputeSummary } from "@/components/ui/dispute-status";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const submitted = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing this request.",
  verified: "Verified — MOVA is in touch with the buyer on next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
};

/**
 * Reservations against this seller's own listings. There was no seller-
 * facing view of purchase_requests at all before this — "My listings"
 * (app/seller/listings) only ever showed a one-line "buyer has paid" banner
 * per vehicle. This is deliberately minimal: enough context to file or see
 * a dispute against a specific reservation, not a redesign of the seller
 * experience.
 *
 * No buyer identity/contact is shown — sellers never see that anywhere in
 * the app today (the buyer reaches out after the fee-paid reveal, not the
 * other way around), and the "users read own" RLS policy wouldn't let this
 * query read the buyer's row anyway.
 */
export default async function SellerReservationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, year, make, model, trim, price_usd")
    .eq("seller_id", user!.id);

  const vehicleRows = vehicles ?? [];
  const vehicleById = new Map(vehicleRows.map((v) => [v.id, v]));
  const vehicleIds = vehicleRows.map((v) => v.id);

  const { data: reservationRows } = vehicleIds.length
    ? await supabase
        .from("purchase_requests")
        .select(
          "id, vehicle_id, status, created_at, vehicle_price_usd, mova_fee_payment_status",
        )
        .in("vehicle_id", vehicleIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const reservations = reservationRows ?? [];
  const reservationIds = reservations.map((r) => r.id);

  const { data: disputeRows } = reservationIds.length
    ? await supabase
        .from("disputes")
        .select(
          "id, purchase_request_id, category, status, description, decision_reason, decision_amount_usd, reporter_id, created_at",
        )
        .in("purchase_request_id", reservationIds)
    : { data: [] };

  const disputesByReservation = new Map<string, DisputeSummary[]>();
  for (const d of disputeRows ?? []) {
    const list = disputesByReservation.get(d.purchase_request_id) ?? [];
    list.push(d);
    disputesByReservation.set(d.purchase_request_id, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/seller/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Seller dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">Reservations</h1>
      <p className="mt-2 text-sm text-gray-500">
        {reservations.length === 0
          ? "No reservations against your listings yet."
          : `${reservations.length} reservation${reservations.length === 1 ? "" : "s"}.`}
      </p>

      {reservations.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-black">Nothing here yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            When a buyer reserves one of your listings, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {reservations.map((r) => {
            const vehicle = vehicleById.get(r.vehicle_id);
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Listing unavailable";
            const price =
              r.vehicle_price_usd != null
                ? Number(r.vehicle_price_usd)
                : vehicle
                  ? Number(vehicle.price_usd)
                  : null;
            const disputes = disputesByReservation.get(r.id) ?? [];
            const hasOwnOpenDispute = disputes.some(
              (d) => d.reporter_id === user!.id && d.status === "open",
            );

            return (
              <li
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-black">
                      {vehicle ? (
                        <Link href={`/browse/${r.vehicle_id}`} className="hover:underline">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </h2>
                    {price != null ? (
                      <p className="mt-1 font-mono text-sm text-gray-500">
                        {usd.format(price)}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-gray-500">
                    {submitted.format(new Date(r.created_at))}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {RESERVATION_STATUS_COPY[r.status] ?? r.status}
                </p>
                {r.mova_fee_payment_status === "paid" ? (
                  <p className="mt-2 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
                    Buyer has paid MOVA&rsquo;s service fee — expect direct contact.
                  </p>
                ) : null}

                <DisputeStatusList disputes={disputes} currentUserId={user!.id} />
                {!hasOwnOpenDispute ? <ReportIssuePanel purchaseRequestId={r.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
