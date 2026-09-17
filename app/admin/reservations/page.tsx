import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { feeBreakdown } from "@/lib/fees";
import { bankTransferReference } from "@/lib/bank-transfer";
import type { FeeResponsibility, PurchaseRequestStatus } from "@/types/database";
import { ReservationActions } from "./reservation-actions";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
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
      "id, vehicle_id, buyer_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url, shipping_rate_id, bank_transfer_proof_path, bank_transfer_proof_uploaded_at",
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
          .select(
            "id, year, make, model, trim, vehicle_vin_display, price_usd, status, fee_responsibility",
          )
          .in("id", vehicleIds)
      : null,
  ]);

  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));
  const vehicleById = new Map((vehiclesRes?.data ?? []).map((v) => [v.id, v]));

  // Signed URLs for pending bank-transfer proofs — the bucket is private
  // (migration 0014), so admin viewing goes through a short-lived signed
  // URL generated server-side rather than a public one.
  const proofRows = rows.filter(
    (r) => r.mova_fee_payment_status === "pending_manual_verification" && r.bank_transfer_proof_path,
  );
  const signedUrlEntries = await Promise.all(
    proofRows.map(async (r) => {
      const { data } = await supabase.storage
        .from("bank-transfer-proofs")
        .createSignedUrl(r.bank_transfer_proof_path!, 300);
      return [r.id, data?.signedUrl ?? null] as const;
    }),
  );
  const proofUrlByRequestId = new Map(signedUrlEntries);

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

            const awaitingBankVerification =
              r.mova_fee_payment_status === "pending_manual_verification";
            const price =
              r.vehicle_price_usd != null
                ? Number(r.vehicle_price_usd)
                : vehicle
                  ? Number(vehicle.price_usd)
                  : null;
            const buyerFee =
              price != null
                ? feeBreakdown(
                    price,
                    (vehicle?.fee_responsibility as FeeResponsibility | undefined) ??
                      "buyer_pays_full",
                  ).buyerFee
                : r.mova_fee_usd != null
                  ? Number(r.mova_fee_usd)
                  : null;
            const proofUrl = proofUrlByRequestId.get(r.id) ?? null;

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
                        {usd.format(Number(vehicle.price_usd))} · VIN{" "}
                        {vehicle.vehicle_vin_display}
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
                      : awaitingBankVerification
                        ? "Bank transfer — awaiting verification"
                        : r.mova_fee_payment_status === "bank_transfer_rejected"
                          ? "Bank transfer rejected"
                          : r.mova_fee_checkout_url
                            ? "Link sent — awaiting payment"
                            : "Not requested"}
                  </Detail>
                  <Detail label="Shipping">
                    {r.shipping_rate_id ? "Selected" : "Not selected yet"}
                  </Detail>
                </dl>

                {awaitingBankVerification ? (
                  <div className="mt-4 rounded border border-marine-100 bg-marine-50 p-4">
                    <p className="text-sm font-semibold text-marine-700">
                      Bank transfer — awaiting verification
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                      <Detail label="Reference">{bankTransferReference(r.id)}</Detail>
                      <Detail label="Amount expected">
                        {buyerFee != null ? usdCents.format(buyerFee) : "—"}
                      </Detail>
                      {r.bank_transfer_proof_uploaded_at ? (
                        <Detail label="Submitted">
                          {submitted.format(new Date(r.bank_transfer_proof_uploaded_at))}
                        </Detail>
                      ) : null}
                    </dl>
                    {proofUrl ? (
                      r.bank_transfer_proof_path?.toLowerCase().endsWith(".pdf") ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-sm text-marine-700 underline underline-offset-2"
                        >
                          View proof (PDF) &rarr;
                        </a>
                      ) : (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={proofUrl}
                            alt="Bank transfer proof"
                            className="max-h-64 rounded border border-paper-200 object-contain"
                          />
                        </a>
                      )
                    ) : (
                      <p className="mt-3 text-sm text-copper-700">
                        Proof file couldn&rsquo;t be loaded.
                      </p>
                    )}
                  </div>
                ) : null}

                <ReservationActions
                  requestId={r.id}
                  canReview={r.status === "submitted"}
                  canRequestFee={
                    (r.status === "under_review" || r.status === "verified") &&
                    r.mova_fee_payment_status !== "paid" &&
                    r.shipping_rate_id != null
                  }
                  shippingSelected={r.shipping_rate_id != null}
                  feeLinkSent={Boolean(r.mova_fee_checkout_url)}
                  feePaid={r.mova_fee_payment_status === "paid"}
                  awaitingBankVerification={awaitingBankVerification}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
