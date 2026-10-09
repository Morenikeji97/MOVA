import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SHIPPER_FEES_ENABLED, countryName } from "@/lib/shipping";
import type {
  CommissionChargeStatus,
  ShipperPaymentStatus,
} from "@/types/database";
import { CompleteShipmentButton } from "./shipment-actions";
import { ReinstateShipperButton } from "../shippers/shipper-admin";
import { EscrowApiPanel } from "@/components/escrow-api-panel";
import { ITEM_STATE_LABEL, escrowApiConfig } from "@/lib/escrow-com";
import { openShippingEscrowAction } from "./actions";
import { refreshEscrowAction } from "../reservations/actions";

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
      <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="text-black">{children}</dd>
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
  const escrowConnected = escrowApiConfig() !== null;

  const { data: requestRows } = await supabase
    .from("shipment_requests")
    .select(
      "id, purchase_request_id, shipper_id, buyer_id, agreed_rate, currency, commission_pct, commission_owed, commission_charge_status, stripe_charge_id, status, created_at, shipping_rate_id, inland_usd, ocean_usd, escrow_transaction_id, escrow_inland_state, escrow_ocean_state, escrow_fee_usd, escrow_synced_at",
    )
    .order("created_at", { ascending: false });

  const requests = requestRows ?? [];
  const shipperIds = [...new Set(requests.map((r) => r.shipper_id))];
  const buyerIds = [...new Set(requests.map((r) => r.buyer_id))];
  const rateIds = [
    ...new Set(requests.map((r) => r.shipping_rate_id).filter((v): v is string => !!v)),
  ];

  const prIds = [...new Set(requests.map((r) => r.purchase_request_id))];

  const [shippersRes, buyersRes, ratesRes, prsRes] = await Promise.all([
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
    // Every shipment belongs to a transaction (purchase_request_id is NOT
    // NULL); show its SM- reference.
    prIds.length
      ? supabase.from("purchase_requests").select("id, reference").in("id", prIds)
      : null,
  ]);

  const shipperById = new Map((shippersRes?.data ?? []).map((s) => [s.id, s]));
  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));
  const rateById = new Map((ratesRes?.data ?? []).map((r) => [r.id, r]));
  const referenceByPr = new Map((prsRes?.data ?? []).map((p) => [p.id, p.reference]));

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
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-black">
        {SHIPPER_FEES_ENABLED ? <>Shipments &amp; commission</> : "Shipments"}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {SHIPPER_FEES_ENABLED ? (
          <>
            Every buyer&rarr;shipper shipment request, and what each shipper owes
            ShipMova in commission.
          </>
        ) : (
          <>
            Every buyer&rarr;shipper shipment request. Shippers pay ShipMova
            nothing: no fees for founding partners.
          </>
        )}
      </p>

      {/* Per-shipper commission summary (only while shipper fees are on) */}
      {SHIPPER_FEES_ENABLED ? (
      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Per-shipper commission
        </h2>
        {shipperIds.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No shipment requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wider text-gray-500">
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
                    <tr key={sid} className="border-t border-gray-200">
                      <td className="py-2 pr-4 text-black">
                        {shipper?.company_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASS[ps]}`}
                        >
                          {PAYMENT_STATUS_LABEL[ps]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-black">
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
                          <span className="text-gray-500">—</span>
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
      ) : null}

      {/* All shipment requests */}
      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          All shipment requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-black">No shipment requests yet.</p>
            <p className="mt-1 text-sm text-gray-500">
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
              // Commission details only while fees are on, or for an older
              // row that actually carried one.
              const showCommission =
                SHIPPER_FEES_ENABLED || Number(r.commission_owed) > 0;

              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-black">
                        {referenceByPr.get(r.purchase_request_id) ?? "—"}
                      </p>
                      <h3 className="text-lg font-semibold text-black">
                        {shipper?.company_name ?? "Shipper unavailable"}
                        {SHIPPER_FEES_ENABLED && shipper && !shipper.card_on_file ? (
                          <span className="ml-2 align-middle text-xs font-normal text-copper-700">
                            no card on file
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 font-mono text-sm text-gray-500">
                        {rate
                          ? `${rate.origin_region} → ${countryName(rate.destination_country)} · `
                          : ""}
                        Rate {money(Number(r.agreed_rate), r.currency)}
                        {showCommission ? (
                          <>
                            {" "}· Commission {r.commission_pct}% ={" "}
                            {money(Number(r.commission_owed), r.currency)}
                          </>
                        ) : null}
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
                      {showCommission ? (
                      <span
                        className={`text-xs font-medium ${
                          chargeStatus === "charged"
                            ? "text-verified-600"
                            : chargeStatus === "failed"
                              ? "text-copper-700"
                              : "text-gray-500"
                        }`}
                      >
                        {CHARGE_LABEL[chargeStatus]}
                      </span>
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <Detail label="Buyer">{buyer?.email ?? "—"}</Detail>
                    <Detail label="Requested">
                      {fmtDate.format(new Date(r.created_at))}
                    </Detail>
                    {showCommission ? (
                      <>
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
                      </>
                    ) : null}
                  </dl>

                  <EscrowApiPanel
                    title="Shipping escrow at Escrow.com"
                    configured={escrowConnected}
                    targetId={r.id}
                    transactionId={r.escrow_transaction_id}
                    lines={[
                      {
                        label: `Inland ${r.inland_usd != null ? money(Number(r.inland_usd), "USD") : "—"} (released at pickup)`,
                        value: ITEM_STATE_LABEL[r.escrow_inland_state ?? "awaiting_payment"],
                      },
                      {
                        label: `Ocean ${r.ocean_usd != null ? money(Number(r.ocean_usd), "USD") : "—"} (released at bill of lading)`,
                        value: ITEM_STATE_LABEL[r.escrow_ocean_state ?? "awaiting_payment"],
                      },
                    ]}
                    feeUsd={r.escrow_fee_usd != null ? Number(r.escrow_fee_usd) : null}
                    syncedAt={r.escrow_synced_at}
                    openAction={openShippingEscrowAction}
                    openLabel="Open shipping escrow at Escrow.com"
                    refreshAction={refreshEscrowAction}
                    blockedReason={
                      r.inland_usd == null || r.ocean_usd == null
                        ? "No inland/ocean split on this shipment (the shipper's rate had no inland portion)."
                        : null
                    }
                  />

                  {r.status === "pending" ? (
                    <div className="mt-4 border-t border-gray-200 pt-4">
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
