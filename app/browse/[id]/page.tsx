import { insuredBadge, isoDay } from "@/lib/shipper-verification";
import { type ReactNode } from "react";
import { displayPlace } from "@/lib/place";
import { Suspense } from "react";
import { ListingChecks, ListingChecksFallback } from "@/components/listing-checks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VEHICLE_DETAIL_COLUMNS, loadFullVins } from "@/lib/listings";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { badgeFacts, listingBadges } from "@/lib/listing-badges";
import { PriceBreakdown, SellerSplitsFeeBadge } from "@/components/ui/price-breakdown";
import { FxNote } from "@/components/ui/fx-note";
import { getFxRates } from "@/lib/fx";
import { currenciesFor } from "@/lib/fx-format";
import { detailCurrencies } from "@/lib/display-currency";
import { getDisplayCurrency } from "@/lib/display-currency-server";
import { feeBreakdown } from "@/lib/fees";
import { loadLandedCostRates } from "@/lib/landed-cost-load";
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
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { CarIcon, CheckIcon, LockIcon } from "@/components/ui/icons";
import { WhatsAppGlyph } from "@/components/ui/whatsapp-button";
import { whatsappLink } from "@/lib/whatsapp";
import { ShippingRates, type PublicRate } from "./shipping-rates";

function Spec({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{children}</dd>
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
        inland_price: r.inland_price != null ? Number(r.inland_price) : null,
        insured: insuredBadge(
          { coi_status: "approved", coi_expires_on: r.coi_expires_on, coi_cargo_limit_usd: r.coi_cargo_limit_usd },
          isoDay(new Date()),
        ),
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
  // A removed listing (seller preview only) shows no badge or done check.
  const badges = listingBadges(facts, v.status);
  const { titleReviewed, verifiedListing } = badges;

  const landedRates = await loadLandedCostRates(supabase);
  const priceLocal = localCurrencies.length && fx ? { fx, currencies: localCurrencies } : null;
  const whatsapp = whatsappLink(`Hi ShipMova, I have a question about the ${title} (listing ${id}).`);

  return (
    <div className="min-h-screen bg-band">
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6">
        {isPreview ? (
          <div className="mb-4 rounded-card border border-marine-700/30 bg-marine-50 p-4 text-sm text-marine-700">
            <p className="font-semibold">
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
          className="flex h-11 w-fit items-center text-sm font-semibold text-muted hover:text-ink"
        >
          &larr; Back to browse
        </Link>

        <div className="mt-1">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {v.mileage.toLocaleString("en-US")} mi · {displayPlace(v.location_city, v.location_state)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1">
            <RatingSummary aggregate={sellerAggregate} />
            <span className="text-xs text-muted">seller rating</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {verifiedListing ? <VerifiedBadge /> : null}
            {v.fee_responsibility === "split" ? <SellerSplitsFeeBadge /> : null}
            <ImportBadge vinModelYearCode={v.vin_model_year_code} year={v.year} />
          </div>
        </div>

        {/* Phones: photos, then price and actions, then details. Desktop:
            price and actions in a column on the right. */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-10">
          <div className="min-w-0 lg:col-start-1">
            {gallery.length > 0 ? (
              <>
                {/* Swipe on phones (the next photo peeks in); a grid from sm up. */}
                <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0">
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
                        "shrink-0 snap-start rounded-card bg-white object-cover sm:w-full",
                        gallery.length > 1 ? "w-[88%]" : "w-full",
                        i === 0 ? "aspect-[4/3] sm:col-span-2 sm:aspect-[16/10]" : "aspect-[4/3]",
                      )}
                    />
                  ))}
                </div>
                {gallery.length > 1 ? (
                  <p className="mt-2 text-xs text-muted sm:hidden">
                    {gallery.length} photos · swipe to see more
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white text-xs font-semibold uppercase tracking-[0.14em] text-muted sm:aspect-[16/10]">
                <CarIcon size={32} />
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
                  className="aspect-video w-full rounded-card bg-ink object-contain"
                />
              </div>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className={cardClasses()}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Price</p>
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
                local={priceLocal}
                className="mt-2"
              />
              <FxNote fx={fx} className="mt-2" />
              {/* Estimate only — never added to "Total before shipping" above. */}
              <ShippingEstimate
                profileCountry={profileCountry}
                modelYear={modelYearFrom(v.vin_model_year_code, v.year)}
                landed={{
                  vehiclePrice: Number(v.price_usd),
                  totalBeforeShipping: feeBreakdown(Number(v.price_usd), v.fee_responsibility).totalBeforeShipping,
                  rates: landedRates,
                }}
                className="mt-4"
              />
            </div>

            {/* Pre-launch: no reserving (reserveVehicle refuses it server-side too),
                so the waitlist stands in — except for a buyer who already has a
                request from before, who still sees its status. */}
            {isPrelaunch() && reserveState !== "requested" ? (
              <WaitlistForm source="listing" vehicleId={id} compact />
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

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: "secondary", className: "w-full" })}
              >
                <WhatsAppGlyph className="h-5 w-5" />
                Ask about this car on WhatsApp
              </a>
            ) : null}

            <section className={cardClasses()} aria-labelledby="checks-heading">
              <h2 id="checks-heading" className="font-display text-lg font-bold text-ink">
                Checks on this listing
              </h2>
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                <TrustCheck done={badges.sellerIdVerified} label="Seller’s ID verified" />
                <TrustCheck
                  done={badges.vinVerified}
                  label="VIN checked against U.S. records"
                />
                <TrustCheck done={titleReviewed} label="Title reviewed by ShipMova" />
              </ul>
              <div className="mt-4 flex gap-3 border-t border-line pt-4 text-sm text-muted">
                <LockIcon size={18} className="mt-0.5 shrink-0 text-ink" />
                <p>
                  You pay the car price into Escrow.com, not to the seller. The seller is paid once
                  the car passes inspection and your shipper has it with the title.{" "}
                  <Link href="/how-it-works" className="font-semibold text-ink underline underline-offset-2">
                    How it works
                  </Link>
                </p>
              </div>
            </section>
          </aside>

          <div className="min-w-0 lg:col-start-1">
            <section className={cardClasses()} aria-labelledby="details-heading">
              <h2 id="details-heading" className="font-display text-lg font-bold text-ink">
                Vehicle details
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Spec label="VIN" className="col-span-2 sm:col-span-1">
                  <span className="break-all font-mono text-sm">{fullVin ?? v.vin_masked}</span>
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
                  {displayPlace(v.location_city, v.location_state)}
                </Spec>
              </dl>
            </section>

            {/* Import rules per country, NHTSA recalls, title history.
                Streams in after the page so a slow lookup never holds it up. */}
            <Suspense fallback={<ListingChecksFallback className="mt-4" />}>
              <ListingChecks vehicle={v} vin={fullVin ?? null} className="mt-4" />
            </Suspense>

            {v.description ? (
              <section className={cardClasses({ className: "mt-4" })}>
                <h2 className="font-display text-lg font-bold text-ink">Description</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">{v.description}</p>
              </section>
            ) : null}

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

            <section className="mt-10">
              <h2 className="font-display text-xl font-bold text-ink">Seller reviews</h2>
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
          </div>
        </div>
      </main>
    </div>
  );
}

/** One line of "Checks on this listing": done, or honestly not yet. */
function TrustCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          done ? "bg-verified-50 text-verified-600" : "bg-band text-muted",
        )}
      >
        {done ? <CheckIcon size={14} /> : <span className="h-0.5 w-2.5 rounded bg-current" />}
      </span>
      <span className={done ? "text-ink" : "text-muted"}>
        {label}
        {done ? null : <span className="block text-xs">Not yet</span>}
      </span>
    </li>
  );
}

export const dynamic = "force-dynamic";
