import { type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { feeBreakdown } from "@/lib/fees";
import { bankTransferReference } from "@/lib/bank-transfer";
import { getAutoReleaseStatus } from "@/lib/auto-release";
import { loadFullVins } from "@/lib/listings";
import { isPrelaunch } from "@/lib/prelaunch";
import type { FeeResponsibility, PurchaseRequestStatus } from "@/types/database";
import { ReservationActions } from "./reservation-actions";
import { EscrowForm } from "./escrow-form";
import { EscrowApiPanel } from "@/components/escrow-api-panel";
import { ITEM_STATE_LABEL, escrowApiConfig } from "@/lib/escrow-com";
import { openCarEscrowAction, refreshEscrowAction } from "./actions";
import { AssignInspectorForm } from "../inspections/forms";

const INSPECTION_STATUS_LABEL: Record<string, string> = {
  assigned: "Inspector assigned",
  submitted: "Report in — needs your decision",
  passed: "Passed",
  failed: "Failed",
};
import { mediaUrl } from "@/lib/media-url";
import { BackLink, DashboardShell } from "@/components/ui/dashboard";

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
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminReservationsPage() {
  const supabase = await createClient();
  // Only whether Escrow.com is connected goes to the page, never the credentials.
  const escrowConnected = escrowApiConfig() !== null;
  const prelaunch = isPrelaunch();

  const { data: requests } = await supabase
    .from("purchase_requests")
    .select(
      "id, reference, escrow_reference, escrow_stage, escrow_car_state, escrow_fee_usd, escrow_synced_at, vehicle_id, buyer_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url, shipping_rate_id, bank_transfer_proof_path, bank_transfer_proof_uploaded_at, fee_payment_requested_at, bank_transfer_reviewed_at",
    )
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: true });

  const rows = requests ?? [];
  const buyerIds = [...new Set(rows.map((r) => r.buyer_id))];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id))];
  // Latest inspection per deal (0063).
  const { data: inspectionRows } = rows.length
    ? await supabase
        .from("inspections")
        .select("id, purchase_request_id, status, created_at")
        .in("purchase_request_id", rows.map((r) => r.id))
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
    : { data: [] };
  const inspectionByDeal = new Map<string, { id: string; status: string }>();
  for (const x of inspectionRows ?? []) {
    if (!inspectionByDeal.has(x.purchase_request_id)) inspectionByDeal.set(x.purchase_request_id, x);
  }

  const [buyersRes, vehiclesRes] = await Promise.all([
    buyerIds.length
      ? supabase.from("users").select("id, email, phone").in("id", buyerIds)
      : null,
    vehicleIds.length
      ? supabase
          .from("vehicles")
          .select(
            "id, year, make, model, trim, vin_masked, price_usd, status, fee_responsibility",
          )
          .in("id", vehicleIds)
      : null,
  ]);

  const buyerById = new Map((buyersRes?.data ?? []).map((b) => [b.id, b]));
  const vehicleById = new Map((vehiclesRes?.data ?? []).map((v) => [v.id, v]));
  const fullVinById = await loadFullVins(supabase, vehicleIds);

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
      return [r.id, data?.signedUrl ? mediaUrl(data.signedUrl) : null] as const;
    }),
  );
  const proofUrlByRequestId = new Map(signedUrlEntries);
  const now = new Date();

  return (
    <DashboardShell>
      <BackLink href="/admin/dashboard">Admin dashboard</BackLink>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">Reservation requests</h1>
      <p className="mt-2 text-sm text-muted">
        {rows.length === 0
          ? "No open reservation requests."
          : `${rows.length} open request${rows.length === 1 ? "" : "s"}.`}
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line bg-white p-10 text-center">
          <p className="text-ink">Nothing to action.</p>
          <p className="mt-1 text-sm text-muted">
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
            const autoRelease =
              r.mova_fee_payment_status === "paid"
                ? null
                : getAutoReleaseStatus(
                    {
                      feePaymentRequestedAt: r.fee_payment_requested_at,
                      movaFeePaymentStatus: r.mova_fee_payment_status,
                      bankTransferReviewedAt: r.bank_transfer_reviewed_at,
                    },
                    now,
                  );
            const hoursRemainingLabel =
              autoRelease?.hoursRemaining != null
                ? Math.max(1, Math.ceil(autoRelease.hoursRemaining))
                : null;

            return (
              <li
                key={r.id}
                className="rounded-card border border-line bg-white shadow-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-medium text-ink">{r.reference}</p>
                    <h2 className="font-display text-lg font-bold text-ink">
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
                      <p className="mt-1 font-mono text-sm text-muted">
                        {usd.format(Number(vehicle.price_usd))} · VIN{" "}
                        {fullVinById.get(vehicle.id) ?? vehicle.vin_masked}
                        {vehicle.status !== "approved"
                          ? ` · listing now ${vehicle.status}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-marine-50 px-2.5 py-1 text-sm font-medium text-marine-700">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {autoRelease?.state === "paused" ? (
                      <span className="inline-flex items-center rounded-full bg-marine-50 px-2.5 py-1 text-xs font-medium text-marine-700">
                        Awaiting your review
                      </span>
                    ) : autoRelease?.state === "expiring_soon" ||
                      autoRelease?.state === "due_for_release" ? (
                      <span className="inline-flex items-center rounded-full bg-copper-50 px-2.5 py-1 text-xs font-medium text-copper-700">
                        {autoRelease.state === "due_for_release"
                          ? "Releasing shortly"
                          : `Expires in ~${hoursRemainingLabel}h`}
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail label="Buyer">{buyer?.email ?? "—"}</Detail>
                  {buyer?.phone ? <Detail label="Phone">{buyer.phone}</Detail> : null}
                  <Detail label="Requested">
                    {submitted.format(new Date(r.created_at))}
                  </Detail>
                  <Detail label="ShipMova fee">
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
                  {autoRelease?.state === "active" ? (
                    <Detail label="Auto-release">
                      ~{hoursRemainingLabel}h remaining
                    </Detail>
                  ) : null}
                </dl>

                {awaitingBankVerification ? (
                  <div className="mt-4 rounded-lg border border-marine-100 bg-marine-50 p-4">
                    <p className="text-sm font-semibold text-marine-700">
                      Bank transfer — awaiting verification
                    </p>
                    <p className="mt-1 text-sm text-marine-700">
                      The buyer already acted — this won&rsquo;t auto-expire
                      while it&rsquo;s in your queue.
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
                          className="mt-3 inline-block text-sm text-ink underline underline-offset-2"
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
                            className="max-h-64 rounded-lg border border-line object-contain"
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
                  prelaunch={prelaunch}
                />
                <EscrowForm
                  requestId={r.id}
                  escrowReference={r.escrow_reference}
                  escrowStage={r.escrow_stage}
                />
                <EscrowApiPanel
                  title="Car escrow at Escrow.com"
                  configured={escrowConnected}
                  targetId={r.id}
                  transactionId={r.escrow_reference && /^\d+$/.test(r.escrow_reference) ? r.escrow_reference : null}
                  lines={[{ label: "Car price", value: ITEM_STATE_LABEL[r.escrow_car_state ?? "awaiting_payment"] }]}
                  feeUsd={r.escrow_fee_usd != null ? Number(r.escrow_fee_usd) : null}
                  syncedAt={r.escrow_synced_at}
                  openAction={openCarEscrowAction}
                  openLabel="Open car escrow at Escrow.com"
                  refreshAction={refreshEscrowAction}
                  blockedReason={
                    r.escrow_reference
                      ? "Escrow reference was entered by hand."
                      : r.mova_fee_payment_status !== "paid"
                        ? "Opens once the buyer has paid ShipMova's fee."
                        : null
                  }
                />
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Inspection at pickup</p>
                  {inspectionByDeal.get(r.id) ? (
                    <Link
                      href={`/admin/inspections/${inspectionByDeal.get(r.id)!.id}`}
                      className="mt-1 inline-flex h-11 items-center text-sm text-ink underline"
                    >
                      {INSPECTION_STATUS_LABEL[inspectionByDeal.get(r.id)!.status] ?? inspectionByDeal.get(r.id)!.status} — open report
                    </Link>
                  ) : r.mova_fee_payment_status === "paid" ? (
                    <AssignInspectorForm purchaseRequestId={r.id} />
                  ) : (
                    <p className="mt-1 text-sm text-muted">Assigned once the buyer has paid ShipMova&rsquo;s fee.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
