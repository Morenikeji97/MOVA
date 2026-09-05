import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseRequestStatus } from "@/types/database";
import { ReservationActions } from "./reservation-actions";

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

// The open queue — terminal states (cancelled / rejected / completed) drop off.
const OPEN_STATUSES: PurchaseRequestStatus[] = [
  "submitted",
  "under_review",
  "verified",
];

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function AdminReservationsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("purchase_requests")
    .select(
      "id, vehicle_id, buyer_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url",
    )
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: true });

  const rows = requests ?? [];
  const buyerIds = [...new Set(rows.map((r) => r.buyer_id))];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id))];

  const [buyersRes, vehiclesRes] = await Promise.all([
    buyerIds.length
      ? supabase.from("users").select("id, email, phone").in("id", buyerIds)
      : null,
    vehicleIds.length
      ? supabase
          .from("vehicles")
          .select("id, year, make, model, trim, vin, price_usd, status")
          .in("id", vehicleIds)
      : null,
  ]);

  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));
  const vehicleById = new Map((vehiclesRes?.data ?? []).map((v) => [v.id, v]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">Reservation requests</h1>
      <p className="mt-2 text-sm text-slate-500">
        {rows.length === 0
          ? "No open reservation requests."
          : `${rows.length} open request${rows.length === 1 ? "" : "s"}.`}
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
          <p className="text-ink-900">Nothing to action.</p>
          <p className="mt-1 text-sm text-slate-500">
            Buyer reservation requests from vehicle pages will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((r) => {
            const buyer = buyerById.get(r.buyer_id);
            const vehicle = vehicleById.get(r.vehicle_id);
            const title = vehicle
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                  vehicle.trim ? ` ${vehicle.trim}` : ""
                }`
              : "Vehicle unavailable";

            return (
              <li
                key={r.id}
                className="rounded-lg border border-paper-200 bg-paper-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">
                      {vehicle ? (
                        <Link
                          href={`/browse/${r.vehicle_id}`}
                          className="hover:underline"
                        >
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </h2>
                    {vehicle ? (
                      <p className="mt-1 font-mono text-sm text-ink-400">
                        {usd.format(Number(vehicle.price_usd))} · VIN {vehicle.vin}
                        {vehicle.status !== "approved"
                          ? ` · listing now ${vehicle.status}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail label="Buyer">{buyer?.email ?? "—"}</Detail>
                  {buyer?.phone ? <Detail label="Phone">{buyer.phone}</Detail> : null}
                  <Detail label="Requested">
                    {submitted.format(new Date(r.created_at))}
                  </Detail>
                  <Detail label="MOVA fee">
                    {r.mova_fee_payment_status === "paid"
                      ? "Paid"
                      : r.mova_fee_checkout_url
                        ? "Link sent — awaiting payment"
                        : "Not requested"}
                  </Detail>
                </dl>

                <ReservationActions
                  requestId={r.id}
                  canReview={r.status === "submitted"}
                  canRequestFee={
                    (r.status === "under_review" || r.status === "verified") &&
                    r.mova_fee_payment_status !== "paid"
                  }
                  feeLinkSent={Boolean(r.mova_fee_checkout_url)}
                  feePaid={r.mova_fee_payment_status === "paid"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
