import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { feeBreakdown } from "@/lib/fees";
import { bankTransferDetails, bankTransferReference } from "@/lib/bank-transfer";
import { BuyerReviewHub } from "@/components/reviews/buyer-review-hub";
import { ReferralPanel } from "@/components/ui/referral-panel";
import { AcceptPricePrompt } from "@/components/ui/accept-price-prompt";
import { ReportIssuePanel } from "@/components/ui/report-issue-panel";
import { DisputeStatusList, type DisputeSummary } from "@/components/ui/dispute-status";
import { PriceBreakdown } from "@/components/ui/price-breakdown";
import { countryName, shippingMethodLabel } from "@/lib/shipping";
import { FeePaymentOptions } from "@/components/ui/fee-payment-options";
import type { FeeResponsibility } from "@/types/database";

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const RESERVATION_STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for MOVA to review.",
  under_review: "MOVA is reviewing your request.",
  verified: "Verified — MOVA will be in touch with next steps.",
  completed: "Completed.",
  rejected: "Not accepted.",
  cancelled: "Released.",
  expired:
    "Your reservation expired — payment wasn't completed in time. You can reserve this vehicle again if it's still available.",
};

const OPEN_STATUSES = ["submitted", "under_review", "verified"];

function Contact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="text-black">{value}</dd>
    </div>
  );
}

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

  const [{ data: profileData }, { data: reservationRows }] = await Promise.all([
    supabase
      .from("buyer_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("purchase_requests")
      .select(
        "id, vehicle_id, status, created_at, vehicle_price_usd, mova_fee_usd, mova_fee_payment_status, mova_fee_checkout_url, seller_details_revealed_at, seller_name, seller_email, seller_phone, seller_whatsapp, negotiated_price_usd, negotiated_price_status, shipping_rate_id, bank_transfer_rejection_reason",
      )
      .eq("buyer_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileData;
  const reservations = reservationRows ?? [];
  const bankDetails = bankTransferDetails();

  // The "fee is being confirmed" banner is only meaningful while a payment the
  // buyer has made is still waiting on the webhook to reveal seller details.
  // Once seller_details_revealed_at is set there is nothing left to confirm.
  const awaitingSellerReveal = reservations.some(
    (r) =>
      r.mova_fee_checkout_url != null &&
      r.seller_details_revealed_at == null &&
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
      <p className="mt-1 font-mono text-sm text-gray-500">
        NIN verification: {profile?.nin_verification_status ?? "unverified"}
      </p>

      {feeNotice === "paid" && awaitingSellerReveal ? (
        <p className="mt-6 rounded border border-verified-100 bg-verified-50 p-3 text-sm text-verified-600">
          Thanks — your MOVA service fee is being confirmed. The seller&rsquo;s
          contact and payment details appear below as soon as Stripe confirms,
          usually within a minute.
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
              Reserve a vehicle from its listing to send MOVA a request.
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
              // other just needs MOVA to.
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
                      MOVA&rsquo;s service fee will be based on this price.
                    </p>
                  ) : null}

                  {showNeedsShipping ? (
                    <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
                      Choose a destination and shipper on the listing page —
                      MOVA can&rsquo;t send your invoice until shipping is
                      selected.{" "}
                      <Link href={`/browse/${r.vehicle_id}`} className="underline">
                        Select shipping
                      </Link>
                    </p>
                  ) : null}

                  {showFeePending ? (
                    <p className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm text-gray-500">
                      Shipping selected. MOVA will send your service-fee
                      payment link here once your reservation has been
                      reviewed.
                    </p>
                  ) : null}

                  {showPaymentOptions ? (
                    <div className="mt-3 rounded border border-marine-100 bg-marine-50 p-4">
                      <p className="text-sm font-medium text-marine-700">
                        Pay MOVA&rsquo;s service fee
                        {buyerFee != null ? ` — ${usdCents.format(buyerFee)}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Paying this unlocks the seller&rsquo;s contact and payment
                        details. You then wire the vehicle price to the seller
                        directly.
                      </p>
                      {feeBankTransferRejected ? (
                        <p className="mt-3 rounded border border-copper-100 bg-copper-50 p-3 text-sm text-copper-700">
                          MOVA couldn&rsquo;t confirm your last bank transfer
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
                      MOVA is verifying your bank transfer (reference{" "}
                      {bankTransferReference(r.id)}). This can take a little
                      longer than an instant card payment — the seller&rsquo;s
                      contact details will appear here once it&rsquo;s
                      confirmed.
                    </p>
                  ) : null}

                  {feePaid ? (
                    <div className="mt-3 rounded border border-verified-100 bg-verified-50 p-4">
                      <p className="text-sm font-semibold text-black">
                        Seller contact &amp; payment details
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        MOVA&rsquo;s service fee is paid. Wire the vehicle price
                        below to the seller directly — the fee is not part of that
                        amount.
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                        <Contact label="Seller" value={r.seller_name} />
                        <Contact label="Email" value={r.seller_email} />
                        <Contact label="Phone" value={r.seller_phone} />
                        <Contact label="WhatsApp" value={r.seller_whatsapp} />
                        <div>
                          <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">
                            Wire to seller
                          </dt>
                          <dd className="font-semibold text-black">
                            {snapshotPrice != null
                              ? usdCents.format(snapshotPrice)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      {!r.seller_name &&
                      !r.seller_email &&
                      !r.seller_phone &&
                      !r.seller_whatsapp ? (
                        <p className="mt-2 text-sm text-copper-700">
                          The seller hasn&rsquo;t added contact details yet — MOVA
                          will follow up with you directly.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

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
