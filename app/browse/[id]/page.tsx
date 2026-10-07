import { type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VEHICLE_DETAIL_COLUMNS, loadFullVins } from "@/lib/listings";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import {
  badgeFacts,
  hasTitleReviewedBadge,
  hasVerifiedListingBadge,
} from "@/lib/listing-badges";
import { PriceBreakdown, SellerSplitsFeeBadge } from "@/components/ui/price-breakdown";
import { FxNote } from "@/components/ui/fx-note";
import { getFxRates } from "@/lib/fx";
import { currenciesFor } from "@/lib/fx-format";
import { detailCurrencies } from "@/lib/display-currency";
import { getDisplayCurrency } from "@/lib/display-currency-server";
import { feeBreakdown } from "@/lib/fees";
import { compareRatesForBuyer, countryName, shippingMethodLabel } from "@/lib/shipping";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { ReviewForm } from "@/components/ui/review-form";
import { toAggregate } from "@/lib/reviews";
import { ReserveVehicle, type ReserveState } from "./reserve-vehicle";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { ShippingEstimate } from "@/components/ui/shipping-estimate";
import { ImportBadge } from "@/components/ui/import-badge";
import { modelYearFrom } from "@/lib/import-rules";
import { mediaUrl } from "@/lib/media-url";
import { isPrelaunch } from "@/lib/prelaunch";
import { MessageSeller } from "./message-seller";
import { ShippingRates, type PublicRate } from "./shipping-rates";

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-xs uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="text-black">{children}</dd>
    </div>
  );
}

const PREVIEW_STATUS_LABEL: Partial<Record<string, string>> = {
  draft: "draft",
  pending_review: "waiting for ShipMova's review",
  rejected: "not approved — see your listings",
  sold: "sold",
  archived: "removed",
};

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: v }, {
    data: { user },
  }] = await Promise.all([
    supabase.from("vehicles").select(VEHICLE_DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  // Buyers only ever see approved listings. The seller may also open their
  // own draft / pending / rejected listing here ("Preview listing" on the
  // seller dashboard) to see exactly what buyers will see. RLS already limits
  // which rows each viewer can read; this keeps non-approved ones owner-only
  // even for viewers RLS lets further (admins use the review queue).
  const isPreview = !!v && v.status !== "approved" && !!user && v.seller_id === user.id;
  if (!v || (v.status !== "approved" && !isPreview)) notFound();

  let reserveState: ReserveState = "anonymous";
  let requestStatus: string | null = null;
  let requestId: string | null = null;
  let negotiatedPriceUsd: number | null = null;
  let negotiatedPriceStatus: "none" | "proposed" | "accepted" = "none";
  let selectedShippingRateId: string | null = null;
  let shippingSelectionLocked = false;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "buyer") {
      reserveState = "not-buyer";
    } else {
      const { data: existing } = await supabase
        .from("purchase_requests")
        .select(
          "id, status, negotiated_price_usd, negotiated_price_status, shipping_rate_id, mova_fee_checkout_url",
        )
        .eq("vehicle_id", id)
        .eq("buyer_id", user.id)
        .not("status", "in", "(cancelled,rejected)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        reserveState = "requested";
        requestStatus = existing.status;
        requestId = existing.id;
        negotiatedPriceUsd =
          existing.negotiated_price_usd != null ? Number(existing.negotiated_price_usd) : null;
        negotiatedPriceStatus = existing.negotiated_price_status;
        selectedShippingRateId = existing.shipping_rate_id;
        shippingSelectionLocked = existing.mova_fee_checkout_url != null;
      } else {
        reserveState = "available";
      }
    }
  }

  // Buyer-facing shipping marketplace: approved shippers' rates to the buyer's
  // country, good-standing first then cheapest, plus any already-selected
  // shippers (contact unlocked). Only for signed-in buyers.
  const isBuyer =
    reserveState === "available" || reserveState === "requested";

  // Existing buyer <-> seller conversation for this vehicle, if any, so the
  // thread shows immediately for a returning buyer.
  let existingConversationId: string | null = null;
  if (user && isBuyer) {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id")
      .eq("vehicle_id", id)
      .eq("buyer_id", user.id)
      .maybeSingle();
    existingConversationId = convo?.id ?? null;
  }

  let shippingRates: PublicRate[] = [];
  let destinationCode = "NG";
  // The buyer's own profile country, unfilled — the shipping estimate
  // prefers it over the browser's last choice, but shouldn't be handed the
  // "NG" fallback as if the buyer had chosen it.
  let profileCountry: string | null = null;

  if (user && isBuyer) {
    const { data: buyerProfile } = await supabase
      .from("buyer_profiles")
      .select("country")
      .eq("user_id", user.id)
      .maybeSingle();
    profileCountry = buyerProfile?.country ?? null;
    destinationCode = buyerProfile?.country || "NG";

    // Every active rate for this vehicle's size class, across all
    // destinations — the destination picker below filters client-side so
    // switching destination doesn't need a round trip. isServiceCountry-only
    // destinations exist by construction (shipping_rates.destination_country
    // is only ever written from that fixed list, see app/shipper/actions.ts).
    const { data: rateRows } = await supabase
      .from("shipper_rates_public")
      .select("*")
      .eq("vehicle_size_type", v.vehicle_size_type);

    shippingRates = (rateRows ?? [])
      .filter((r) => r.rate_id != null && r.shipper_id != null)
      .map((r) => ({
        rate_id: r.rate_id as string,
        shipper_id: r.shipper_id as string,
        company_name: r.company_name ?? "Shipper",
        service_areas: r.service_areas ?? [],
        origin_region: r.origin_region ?? "",
        origin_port: r.origin_port,
        destination_country: r.destination_country ?? destinationCode,
        vehicle_size_type: r.vehicle_size_type as PublicRate["vehicle_size_type"],
        shipping_method: r.shipping_method as PublicRate["shipping_method"],
        price: Number(r.price ?? 0),
        currency: r.currency ?? "USD",
        payment_status: r.payment_status ?? "good_standing",
      }))
      .sort((a, b) => compareRatesForBuyer(a, b, v.location_state));
  }

  const selectedRate = selectedShippingRateId
    ? shippingRates.find((r) => r.rate_id === selectedShippingRateId)
    : undefined;

  // Seller reputation: aggregate + published buyer->seller reviews, and whether
  // the current viewer is eligible to leave one (a fee-paid reservation with
  // this seller that they haven't reviewed yet).
  const [{ data: sellerRatingRow }, { data: sellerReviewRows }] =
    await Promise.all([
      supabase
        .from("seller_ratings")
        .select("avg_rating, review_count")
        .eq("seller_id", v.seller_id)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select("id, review_type, rating, comment, created_at")
        .eq("reviewee_id", v.seller_id)
        .eq("review_type", "buyer_to_seller")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  const sellerAggregate = toAggregate(sellerRatingRow);

  let sellerReviewPrId: string | null = null;
  if (user && isBuyer) {
    const { data: paidPr } = await supabase
      .from("purchase_requests")
      .select("id")
      .eq("vehicle_id", id)
      .eq("buyer_id", user.id)
      .eq("mova_fee_payment_status", "paid")
      .limit(1)
      .maybeSingle();
    if (paidPr) {
      const { data: mine } = await supabase
        .from("reviews")
        .select("id")
        .eq("reviewer_id", user.id)
        .eq("review_type", "buyer_to_seller")
        .eq("purchase_request_id", paidPr.id)
        .maybeSingle();
      if (!mine) sellerReviewPrId = paidPr.id;
    }
  }

  const [{ data: photos }, { data: video }, fx] = await Promise.all([
    supabase
      .from("vehicle_photos")
      .select("url, thumb_url, is_primary, sort_order")
      .eq("vehicle_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("vehicle_videos").select("url").eq("vehicle_id", id).maybeSingle(),
    getFxRates(),
  ]);
  // The header's currency switcher (lib/display-currency.ts): the chosen
  // currency first, none for USD, the usual order with no choice.
  const localCurrencies = detailCurrencies(await getDisplayCurrency(), currenciesFor(profileCountry));

  // Primary photo leads the gallery; the rest keep their sort order.
  const gallery = (photos ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  const title = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;

  // "Verified Listing" used to render unconditionally here. Because this page
  // only shows approved listings, that made the badge a synonym for
  // status = 'approved' — a moderation outcome, not a verification result. It
  // now goes through the shared rules in lib/listing-badges.ts, same as the
  // browse cards and the seller's own listings. See migration 0032.
  const facts = badgeFacts(v);
  // Full VIN only for an admin, the seller, or a buyer past the fee-paid
  // reveal — vehicle_vin decides; everyone else sees vin_masked.
  const fullVin = (await loadFullVins(supabase, [v.id])).get(v.id);
  const titleReviewed = hasTitleReviewedBadge(facts);
  const verifiedListing = hasVerifiedListingBadge(facts);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-6 py-12">
        {isPreview ? (
          <div className="mb-6 rounded-lg border border-marine-700 bg-marine-50 p-4 text-sm text-marine-700">
            <p className="font-medium">
              Preview — buyers can&rsquo;t see this listing yet ({PREVIEW_STATUS_LABEL[v.status] ?? v.status}).
            </p>
            <p className="mt-1">
              This is exactly how it will look once it&rsquo;s approved.{" "}
              <Link href="/seller/listings" className="underline">
                Back to my listings
              </Link>
            </p>
          </div>
        ) : null}
        <Link
          href="/browse"
          className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
        >
          &larr; Back to browse
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-black">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {verifiedListing ? <VerifiedBadge /> : null}
            {v.vin_verification_status === "verified" ? (
              <VerifiedBadge label="VIN Verified" />
            ) : null}
            {titleReviewed ? <VerifiedBadge label="Title reviewed" /> : null}
            {v.fee_responsibility === "split" ? <SellerSplitsFeeBadge /> : null}
            <ImportBadge vinModelYearCode={v.vin_model_year_code} year={v.year} />
          </div>
        </div>
        <PriceBreakdown
          price={Number(v.price_usd)}
          feeResponsibility={v.fee_responsibility}
          shipping={
            selectedRate
              ? {
                  cost: selectedRate.price,
                  label: `${countryName(selectedRate.destination_country)}, ${shippingMethodLabel(selectedRate.shipping_method)}`,
                }
              : null
          }
          variant="detail"
          local={localCurrencies.length && fx ? { fx, currencies: localCurrencies } : null}
          className="mt-3 max-w-xs"
        />
        <FxNote fx={fx} className="mt-1 max-w-xs" />
        {/* Estimate only — never added to "Total before shipping" above. */}
        <ShippingEstimate
          profileCountry={profileCountry}
          modelYear={modelYearFrom(v.vin_model_year_code, v.year)}
          className="mt-3 max-w-md"
        />
        <p className="mt-2 font-mono text-sm text-gray-500">
          {v.mileage.toLocaleString("en-US")} mi · {v.location_city}, {v.location_state}
        </p>
        <div className="mt-2">
          <RatingSummary aggregate={sellerAggregate} />
          <span className="ml-1 font-mono text-xs text-gray-500">seller rating</span>
        </div>

        {gallery.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gallery.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={mediaUrl(p.url)}
                alt={`${title} photo ${i + 1}`}
                // The cover shows at once; the rest load as they scroll near.
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className={cn(
                  "w-full rounded-lg border border-gray-200 object-cover",
                  i === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/3]"
                )}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center font-mono text-xs uppercase tracking-wider text-gray-500">
            No photos provided
          </div>
        )}

        {video ? (
          <div className="mt-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={mediaUrl(video.url)}
              controls
              // Nothing downloads until the buyer presses play (clips run to 100 MB).
              preload="none"
              poster={gallery[0] ? mediaUrl(gallery[0].thumb_url ?? gallery[0].url) : undefined}
              className="aspect-video w-full rounded-lg border border-gray-200 bg-black object-contain"
            />
          </div>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Spec label="VIN">
            <span className="font-mono">{fullVin ?? v.vin_masked}</span>
          </Spec>
          <Spec label="Year">{v.year}</Spec>
          <Spec label="Mileage">{v.mileage.toLocaleString("en-US")} mi</Spec>
          {v.transmission ? <Spec label="Transmission">{v.transmission}</Spec> : null}
          {v.fuel_type ? <Spec label="Fuel">{v.fuel_type}</Spec> : null}
          {v.condition ? <Spec label="Condition">{v.condition}</Spec> : null}
          {v.exterior_color ? <Spec label="Exterior">{v.exterior_color}</Spec> : null}
          {v.interior_color ? <Spec label="Interior">{v.interior_color}</Spec> : null}
          {v.title_status ? <Spec label="Title">{v.title_status}</Spec> : null}
          {v.accident_history ? (
            <Spec label="Accident history">{v.accident_history}</Spec>
          ) : null}
          <Spec label="Location">
            {v.location_city}, {v.location_state}
          </Spec>
        </dl>

        {v.description ? (
          <section className="mt-8">
            <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-500">
              {v.description}
            </p>
          </section>
        ) : null}

        {/* Pre-launch: no reserving (reserveVehicle refuses it server-side too),
            so the waitlist stands in — except for a buyer who already has a
            request from before, who still sees its status. */}
        {isPrelaunch() && reserveState !== "requested" ? (
          <WaitlistForm source="listing" vehicleId={id} className="mt-10" />
        ) : (
        <ReserveVehicle
          vehicleId={id}
          state={reserveState}
          requestStatus={requestStatus}
          buyerFeeUsd={feeBreakdown(Number(v.price_usd), v.fee_responsibility).buyerFee}
          requestId={requestId}
          listingPriceUsd={Number(v.price_usd)}
          negotiatedPriceUsd={negotiatedPriceUsd}
          negotiatedPriceStatus={negotiatedPriceStatus}
        />
        )}

        {user && isBuyer ? (
          <MessageSeller
            vehicleId={id}
            buyerId={user.id}
            existingConversationId={existingConversationId}
          />
        ) : null}

        {/* Arranging shipping needs a real purchase_request_id (see
            shipping-actions.ts) — only once the buyer has actually
            requested this vehicle, not just while browsing. */}
        {user && isBuyer && requestId ? (
          <ShippingRates
            vehicleId={id}
            purchaseRequestId={requestId}
            defaultDestination={destinationCode}
            vehicleState={v.location_state}
            rates={shippingRates}
            selectedRateId={selectedShippingRateId}
            locked={shippingSelectionLocked}
          />
        ) : null}

        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
            Seller reviews
          </h2>
          <div className="mt-2">
            <RatingSummary aggregate={sellerAggregate} size="md" />
          </div>

          {sellerReviewPrId ? (
            <div className="mt-4">
              <ReviewForm
                target={{
                  reviewType: "buyer_to_seller",
                  revieweeId: v.seller_id,
                  purchaseRequestId: sellerReviewPrId,
                }}
                counterpartyLabel="the seller"
              />
            </div>
          ) : null}

          <div className="mt-4">
            <ReviewList
              reviews={(sellerReviewRows ?? []) as PublicReview[]}
              canReport={Boolean(user)}
              emptyLabel="No reviews of this seller yet."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
