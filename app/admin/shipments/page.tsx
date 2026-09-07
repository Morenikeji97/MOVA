import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/shipping";
import type {
  CommissionChargeStatus,
  ShipperPaymentStatus,
} from "@/types/database";
import { CompleteShipmentButton } from "./shipment-actions";
import { ReinstateShipperButton } from "../shippers/shipper-admin";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const fmtDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const PAYMENT_STATUS_LABEL: Record<ShipperPaymentStatus, string> = {
  good_standing: "Good standing",
  past_due: "Past due",
  suspended: "Suspended",
};

const PAYMENT_STATUS_CLASS: Record<ShipperPaymentStatus, string> = {
  good_standing: "bg-verified-50 text-verified-600",
  past_due: "bg-copper-50 text-copper-700",
  suspended: "bg-copper-100 text-copper-700",
};

const CHARGE_LABEL: Record<CommissionChargeStatus, string> = {
  pending: "Commission pending",
  charged: "Commission charged",
  failed: "Commission failed",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">
        {label}
      </dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

interface ShipperTotals {
  owed: number;
  charged: number;
  failed: number;
  currency: string;
}

export default async function AdminShipmentsPage() {
  const supabase = await createClient();

  const { data: requestRows } = await supabase
    .from("shipment_requests")
    .select(
      "id, shipper_id, buyer_id, agreed_rate, currency, commission_pct, commission_owed, commission_charge_status, stripe_charge_id, status, created_at, shipping_rate_id",
    )
    .order("created_at", { ascending: false });

  const requests = requestRows ?? [];
  const shipperIds = [...new Set(requests.map((r) => r.shipper_id))];
  const buyerIds = [...new Set(requests.map((r) => r.buyer_id))];
  const rateIds = [
    ...new Set(requests.map((r) => r.shipping_rate_id).filter((v): v is string => !!v)),
  ];

  const [shippersRes, buyersRes, ratesRes] = await Promise.all([
    shipperIds.length
      ? supabase
          .from("shippers")
          .select("id, company_name, status, payment_status, card_on_file")
          .in("id", shipperIds)
      : null,
    buyerIds.length
      ? supabase.from("users").select("id, email").in("id", buyerIds)
      : null,
    rateIds.length
      ? supabase
          .from("shipping_rates")
          .select("id, origin_region, destination_country")
          .in("id", rateIds)
      : null,
  ]);

  const shipperById = new Map((shippersRes?.data ?? []).map((s) => [s.id, s]));
  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));
  const rateById = new Map((ratesRes?.data ?? []).map((r) => [r.id, r]));

  // Per-shipper commission roll-up.
  const totalsByShipper = new Map<string, ShipperTotals>();
  for (const r of requests) {
    const t =
      totalsByShipper.get(r.shipper_id) ??
      { owed: 0, charged: 0, failed: 0, currency: r.currency || "USD" };
    const owed = Number(r.commission_owed) || 0;
    if (r.commission_charge_status === "charged") t.charged += owed;
    else if (r.commission_charge_status === "failed") t.failed += owed;
    else t.owed += owed;
    totalsByShipper.set(r.shipper_id, t);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link
        href="/admin/dashboard"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">
        Shipments &amp; commission
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Every buyer&rarr;shipper shipment request, and what each shipper owes
        MOVA in commission.
      </p>

      {/* Per-shipper commission summary */}
      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Per-shipper commission
        </h2>
        {shipperIds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No shipment requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-4">Shipper</th>
                  <th className="py-2 pr-4">Standing</th>
                  <th className="py-2 pr-4">Pending</th>
                  <th className="py-2 pr-4">Charged</th>
                  <th className="py-2 pr-4">Failed</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {shipperIds.map((sid) => {
                  const shipper = shipperById.get(sid);
                  const t =
                    totalsByShipper.get(sid) ??
                    { owed: 0, charged: 0, failed: 0, currency: "USD" };
                  const ps = (shipper?.payment_status ??
                    "good_standing") as ShipperPaymentStatus;
                  return (
                    <tr key={sid} className="border-t border-paper-200">
                      <td className="py-2 pr-4 text-ink-900">
                        {shipper?.company_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASS[ps]}`}
                        >
                          {PAYMENT_STATUS_LABEL[ps]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-ink-900">
                        {money(t.owed, t.currency)}
                      </td>
                      <td className="py-2 pr-4 text-verified-600">
                        {money(t.charged, t.currency)}
                      </td>
                      <td className="py-2 pr-4 text-copper-700">
                        {money(t.failed, t.currency)}
                      </td>
                      <td className="py-2">
                        {ps === "suspended" ? (
                          <ReinstateShipperButton shipperId={sid} />
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All shipment requests */}
      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          All shipment requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-10 text-center">
            <p className="text-ink-900">No shipment requests yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              These are created when a buyer selects a shipper at reservation.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {requests.map((r) => {
              const shipper = shipperById.get(r.shipper_id);
              const buyer = buyerById.get(r.buyer_id);
              const rate = r.shipping_rate_id
                ? rateById.get(r.shipping_rate_id)
                : null;
              const chargeStatus =
                r.commission_charge_status as CommissionChargeStatus;

              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-paper-200 bg-paper-100 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink-900">
                        {shipper?.company_name ?? "Shipper unavailable"}
                        {shipper && !shipper.card_on_file ? (
                          <span className="ml-2 align-middle text-xs font-normal text-copper-700">
                            no card on file
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 font-mono text-sm text-ink-400">
                        {rate
                          ? `${rate.origin_region} → ${countryName(rate.destination_country)} · `
                          : ""}
                        Rate {money(Number(r.agreed_rate), r.currency)} ·
                        Commission {r.commission_pct}% ={" "}
                        {money(Number(r.commission_owed), r.currency)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                          r.status === "completed"
                            ? "bg-verified-50 text-verified-600"
                            : "bg-marine-50 text-marine-700"
                        }`}
                      >
                        {r.status === "completed" ? "Completed" : "Pending"}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          chargeStatus === "charged"
                            ? "text-verified-600"
                            : chargeStatus === "failed"
                              ? "text-copper-700"
                              : "text-ink-400"
                        }`}
                      >
                        {CHARGE_LABEL[chargeStatus]}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <Detail label="Buyer">{buyer?.email ?? "—"}</Detail>
                    <Detail label="Requested">
                      {fmtDate.format(new Date(r.created_at))}
                    </Detail>
                    <Detail label="Charge ref">
                      <span className="font-mono text-xs">
                        {r.stripe_charge_id ?? "—"}
                      </span>
                    </Detail>
                    <Detail label="Shipper standing">
                      {shipper
                        ? PAYMENT_STATUS_LABEL[
                            shipper.payment_status as ShipperPaymentStatus
                          ]
                        : "—"}
                    </Detail>
                  </dl>

                  {r.status === "pending" ? (
                    <div className="mt-4 border-t border-paper-200 pt-4">
                      <CompleteShipmentButton shipmentId={r.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";
