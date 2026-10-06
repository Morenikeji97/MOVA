import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuyerIdSummary } from "@/components/buyer-id-summary";
import { feeBreakdown } from "@/lib/fees";
import { bankTransferDetails, bankTransferReference } from "@/lib/bank-transfer";
import { BuyerReviewHub } from "@/components/reviews/buyer-review-hub";
import { ReferralPanel } from "@/components/ui/referral-panel";
import { AcceptPricePrompt } from "@/components/ui/accept-price-prompt";
import { ReportIssuePanel } from "@/components/ui/report-issue-panel";
import { DisputeStatusList, type DisputeSummary } from "@/components/ui/dispute-status";
import { EscrowPayments } from "@/components/escrow-payments";
import { PriceBreakdown } from "@/components/ui/price-breakdown";
import { countryName, shippingMethodLabel } from "@/lib/shipping";
import { FeePaymentOptions } from "@/components/ui/fee-payment-options";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { isPrelaunch } from "@/lib/prelaunch";
import type { FeeResponsibility } from "@/types/database";
import { InspectionBadge } from "@/components/inspection-badge";

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for ShipMova to review.",
  under_review: "ShipMova is reviewing your request.",
  verified: "Verified — ShipMova will be in touch with next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
  expired:
    "Your reservation expired — payment wasn't completed in time. You can reserve this vehicle again if it's still available.",
};

const OPEN_STATUSES = ["submitted", "under_review", "verified"];

export default async function BuyerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ fee?: string }>;
}) {
  const { fee } = await searchParams;
  const feeNotice =
    fee === "paid" ? "paid" : fee === "cancelled" ? "cancelled" : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: idSummary }, { data: reservationRows }] = await Promise.all([
    supabase.rpc("buyer_id_summary", { p_buyer_id: user!.id }),
    supabase
      .from("purchase_requests")
      .select(
        "id, reference, vehicle_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url, negotiated_price_usd, negotiated_price_status, shipping_rate_id, bank_transfer_rejection_reason, escrow_reference, escrow_car_state, escrow_fee_usd",
      )
      .eq("buyer_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const reservations = reservationRows ?? [];
  const bankDetails = bankTransferDetails();
  const prelaunch = isPrelaunch();

  // The "fee is being confirmed" banner is only meaningful while a payment the
  // buyer has made is still waiting on the webhook to mark the fee paid.
  const awaitingFeeConfirmation = reservations.some(
    (r) =>
      r.mova_fee_checkout_url != null &&
      r.mova_fee_payment_status !== "paid" &&
      r.status !== "cancelled" &&
      r.status !== "rejected",
  );

  const vehicleIds = [...new Set(reservations.map((r) => r.vehicle_id))];
  const reservationIds = reservations.map((r) => r.id);
  const shippingRateIds = [
    ...new Set(reservations.map((r) => r.shipping_rate_id).filter((v): v is string => v != null)),
  ];
  const [{ data: vehicleRows }, { data: disputeRows }, { data: shippingRateRows }] =
    await Promise.all([
      vehicleIds.length
        ? supabase
            .from("vehicles")
            .select("id, year, make, model, trim, price_usd, fee_responsibility")
            .in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
      reservationIds.length
        ? supabase
            .from("disputes")
            .select(
              "id, purchase_request_id, category, status, description, decision_reason, decision_amount_usd, reporter_id, created_at",
            )
            .in("purchase_request_id", reservationIds)
        : Promise.resolve({ data: [] }),
      shippingRateIds.length
        ? supabase
            .from("shipper_rates_public")
            .select("rate_id, company_name, destination_country, shipping_method, price, currency")
            .in("rate_id", shippingRateIds)
        : Promise.resolve({ data: [] }),
    ]);
  const vehicleById = new Map((vehicleRows ?? []).map((v) => [v.id, v]));
  // Shipping escrow per reservation (0062).
  const { data: shipmentRows } = reservationIds.length
    ? await supabase
        .from("shipment_requests")
        .select("purchase_request_id, inland_usd, ocean_usd, escrow_transaction_id, escrow_inland_state, escrow_ocean_state, escrow_fee_usd, created_at")
        .in("purchase_request_id", reservationIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const shipmentByReservation = new Map<string, NonNullable<typeof shipmentRows>[number]>();
  for (const sr of shipmentRows ?? []) {
    if (sr.purchase_request_id && !shipmentByReservation.has(sr.purchase_request_id)) {
      shipmentByReservation.set(sr.purchase_request_id, sr);
    }
  }
  // Inspection badge per deal (0063; the function only answers the deal's buyer).
  const inspectionByDeal = new Map(
    await Promise.all(
      reservationIds.map(async (id) => {
        const { data } = await supabase.rpc("inspection_summary", { p_purchase_request_id: id });
        return [id, data ?? null] as const;
      }),
    ),
  );
  const shippingRateById = new Map(
    (shippingRateRows ?? []).map((r) => [r.rate_id as string, r]),
  );
  const disputesByReservation = new Map<string, DisputeSummary[]>();
  for (const d of disputeRows ?? []) {
    const list = disputesByReservation.get(d.purchase_request_id) ?? [];
    list.push(d);
    disputesByReservation.set(d.purchase_request_id, list);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-black">Buyer Dashboard</h1>
      <p className="mt-2 text-gray-500">Signed in as {user?.email}</p>
      {/* Buyers reach this page only once their ID is verified (middleware.ts). */}
      <BuyerIdSummary summary={idSummary ?? null} />

      {feeNotice === "paid" && awaitingFeeConfirmation ? (
        <p className="mt-6 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Thanks — your ShipMova fee is being confirmed. It shows as paid below as
          soon as Stripe confirms, usually within a minute.
        </p>
      ) : null}
      {feeNotice === "cancelled" ? (
        <p className="mt-6 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
          Payment was cancelled. You can reopen the payment link below whenever
          you&rsquo;re ready.
        </p>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-black">Your reservations</h2>
          <Link
            href="/browse"
            className="text-sm text-black hover:underline"
          >
            Browse vehicles &rarr;
          </Link>
        </div>

        {reservations.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-black">You haven&rsquo;t reserved any vehicles yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Reserve a vehicle from its listing to send ShipMova a request.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {reservations.map((r) => {
              const vehicle = vehicleById.get(r.vehicle_id);
              const title = vehicle
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${
                    vehicle.trim ? ` ${vehicle.trim}` : ""
                  }`
                : "Vehicle no longer listed";

              const feePaid = r.mova_fee_payment_status === "paid";

              // The buyer's fee portion: prefer the live listing's split choice;
              // fall back to the full snapshotted fee if the listing is gone.
              const fullFee = r.mova_fee_usd != null ? Number(r.mova_fee_usd) : null;
              const feeResponsibility =
                (vehicle?.fee_responsibility as FeeResponsibility | undefined) ??
                "buyer_pays_full";
              const snapshotPrice =
                r.vehicle_price_usd != null ? Number(r.vehicle_price_usd) : null;
              const buyerFee =
                snapshotPrice != null
                  ? feeBreakdown(snapshotPrice, feeResponsibility).buyerFee
                  : fullFee != null
                    ? feeResponsibility === "split"
                      ? fullFee / 2
                      : fullFee
                    : null;

              const shippingRate = r.shipping_rate_id
                ? shippingRateById.get(r.shipping_rate_id)
                : undefined;

              const feeAwaitingBankVerification =
                r.mova_fee_payment_status === "pending_manual_verification";
              const feeBankTransferRejected =
                r.mova_fee_payment_status === "bank_transfer_rejected";

              const showPaymentOptions =
                !feePaid &&
                !feeAwaitingBankVerification &&
                OPEN_STATUSES.includes(r.status) &&
                Boolean(r.mova_fee_checkout_url);
              // Two distinct reasons the fee link isn't here yet — worth
              // telling apart, since one needs the buyer to act and the
              // other just needs ShipMova to.
              const showNeedsShipping =
                !feePaid &&
                OPEN_STATUSES.includes(r.status) &&
                !r.mova_fee_checkout_url &&
                !r.shipping_rate_id;
              const showFeePending =
                !feePaid &&
                !feeAwaitingBankVerification &&
                OPEN_STATUSES.includes(r.status) &&
                !r.mova_fee_checkout_url &&
                Boolean(r.shipping_rate_id);

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
                      <p className="font-mono text-xs text-gray-500">{r.reference}</p>
                      <h3 className="font-semibold text-black">
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
                      </h3>
                      {snapshotPrice != null || vehicle ? (
                        <PriceBreakdown
                          price={snapshotPrice ?? Number(vehicle!.price_usd)}
                          feeResponsibility={feeResponsibility}
                          shipping={
                            shippingRate
                              ? {
                                  cost: Number(shippingRate.price),
                                  label: `${countryName(shippingRate.destination_country)}, ${shippingMethodLabel(shippingRate.shipping_method as "roro" | "container")}`,
                                }
                              : null
                          }
                          className="mt-1 max-w-xs"
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {RESERVATION_STATUS_COPY[r.status] ?? r.status}
                  </p>

                  {r.negotiated_price_status === "proposed" &&
                  r.negotiated_price_usd != null &&
                  OPEN_STATUSES.includes(r.status) ? (
                    <AcceptPricePrompt
                      purchaseRequestId={r.id}
                      listingPriceUsd={snapshotPrice ?? Number(vehicle?.price_usd ?? 0)}
                      negotiatedPriceUsd={Number(r.negotiated_price_usd)}
                    />
                  ) : null}

                  {r.negotiated_price_status === "accepted" &&
                  r.negotiated_price_usd != null &&
                  !feePaid ? (
                    <p className="mt-3 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
                      You accepted {usdCents.format(Number(r.negotiated_price_usd))} —
                      ShipMova&rsquo;s service fee will be based on this price.
                    </p>
                  ) : null}

                  {showNeedsShipping ? (
                    <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
                      Choose a destination and shipper on the listing page —
                      ShipMova can&rsquo;t send your invoice until shipping is
                      selected.{" "}
                      <Link href={`/browse/${r.vehicle_id}`} className="underline">
                        Select shipping
                      </Link>
                    </p>
                  ) : null}

                  {showFeePending ? (
                    <p className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm text-gray-500">
                      Shipping selected. ShipMova will send your service-fee
                      payment link here once your reservation has been
                      reviewed.
                    </p>
                  ) : null}

                  {showPaymentOptions && prelaunch ? (
                    <WaitlistForm
                      source="dashboard"
                      vehicleId={r.vehicle_id}
                      heading="Payments open at launch"
                      intro="ShipMova isn't taking payments yet. Join the waitlist and we'll tell you the moment you can pay and continue."
                      className="mt-3"
                    />
                  ) : null}

                  {showPaymentOptions && !prelaunch ? (
                    <div className="mt-3 rounded border border-marine-100 bg-marine-50 p-4">
                      <p className="text-sm font-medium text-marine-700">
                        Pay ShipMova&rsquo;s fee
                        {buyerFee != null ? ` — ${usdCents.format(buyerFee)}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        This covers ShipMova&rsquo;s verification and coordination.
                        Next, the car price goes into Escrow.com — never to the
                        seller or ShipMova directly.
                      </p>
                      {feeBankTransferRejected ? (
                        <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
                          ShipMova couldn&rsquo;t confirm your last bank transfer
                          {r.bank_transfer_rejection_reason
                            ? `: ${r.bank_transfer_rejection_reason}`
                            : "."}{" "}
                          You can try again below, or pay with card instead.
                        </p>
                      ) : null}
                      <FeePaymentOptions
                        purchaseRequestId={r.id}
                        checkoutUrl={r.mova_fee_checkout_url!}
                        buyerFeeUsd={buyerFee}
                        bankDetails={bankDetails}
                        referenceCode={bankTransferReference(r.id)}
                      />
                    </div>
                  ) : null}

                  {feeAwaitingBankVerification ? (
                    <p className="mt-3 rounded border border-marine-100 bg-marine-50 p-3 text-sm text-marine-700">
                      ShipMova is verifying your bank transfer (reference{" "}
                      {bankTransferReference(r.id)}). This can take a little
                      longer than an instant card payment — it shows as paid
                      here once it&rsquo;s confirmed.
                    </p>
                  ) : null}

                  {feePaid ? (
                    <div className="mt-3 rounded border border-verified-100 bg-verified-50 p-4">
                      <p className="text-sm font-semibold text-black">
                        ShipMova&rsquo;s fee is paid
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Next, the car price goes into Escrow.com. ShipMova sets up
                        the escrow transaction and it appears here. The seller
                        is only paid once the car passes inspection and your
                        shipper has it and the original title.
                      </p>
                      <p className="mt-2 text-sm text-copper-700">
                        ShipMova will never send you bank details on WhatsApp,
                        email or text, or ask you to pay a person directly. If
                        anyone does, it&rsquo;s a scam — stop and message us.
                      </p>
                    </div>
                  ) : null}

                  <EscrowPayments
                    car={{
                      open: Boolean(r.escrow_reference),
                      priceUsd:
                        r.negotiated_price_status === "accepted" && r.negotiated_price_usd != null
                          ? Number(r.negotiated_price_usd)
                          : r.vehicle_price_usd != null
                            ? Number(r.vehicle_price_usd)
                            : null,
                      state: r.escrow_car_state,
                      feeUsd: r.escrow_fee_usd != null ? Number(r.escrow_fee_usd) : null,
                    }}
                    shipping={(() => {
                      const sr = shipmentByReservation.get(r.id);
                      return sr
                        ? {
                            open: Boolean(sr.escrow_transaction_id),
                            inlandUsd: sr.inland_usd != null ? Number(sr.inland_usd) : null,
                            oceanUsd: sr.ocean_usd != null ? Number(sr.ocean_usd) : null,
                            inlandState: sr.escrow_inland_state,
                            oceanState: sr.escrow_ocean_state,
                            feeUsd: sr.escrow_fee_usd != null ? Number(sr.escrow_fee_usd) : null,
                          }
                        : null;
                    })()}
                  />
                  <InspectionBadge summary={inspectionByDeal.get(r.id) ?? null} />

                  <DisputeStatusList disputes={disputes} currentUserId={user!.id} />
                  {!hasOwnOpenDispute ? (
                    <ReportIssuePanel purchaseRequestId={r.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BuyerReviewHub userId={user!.id} />

      <ReferralPanel userId={user!.id} />
    </main>
  );
}
