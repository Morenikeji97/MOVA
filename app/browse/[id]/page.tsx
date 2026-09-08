import { type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PriceBreakdown } from "@/components/ui/price-breakdown";
import { feeBreakdown } from "@/lib/fees";
import { compareRatesForBuyer, countryName } from "@/lib/shipping";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { ReviewForm } from "@/components/ui/review-form";
import { toAggregate } from "@/lib/reviews";
import { ReserveVehicle, type ReserveState } from "./reserve-vehicle";
import { MessageSeller } from "./message-seller";
import {
  ShippingRates,
  type PublicRate,
  type SelectedShipper,
} from "./shipping-rates";

function BrowseHeader() {
  return (
    <header className="border-b border-paper-200 bg-paper-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono text-sm font-semibold uppercase tracking-widest text-ink-900">
          MOVA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/shipper" className="text-slate-500 hover:text-ink-900">
            Shippers
          </Link>
          <Link href="/login" className="text-slate-500 hover:text-ink-900">
            Sign in
          </Link>
          <Link href="/signup" className={buttonClasses({ size: "sm" })}>
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-xs uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: v } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (!v) notFound();

  // Reserve CTA state depends on who's viewing.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reserveState: ReserveState = "anonymous";
  let requestStatus: string | null = null;

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
        .select("status")
        .eq("vehicle_id", id)
        .eq("buyer_id", user.id)
        .not("status", "in", "(cancelled,rejected)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        reserveState = "requested";
        requestStatus = existing.status;
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
  let selectedShippers: SelectedShipper[] = [];
  let destinationCode = "NG";

  if (user && isBuyer) {
    const { data: buyerProfile } = await supabase
      .from("buyer_profiles")
      .select("country")
      .eq("user_id", user.id)
      .maybeSingle();
    destinationCode = buyerProfile?.country || "NG";

    const [{ data: rateRows }, { data: shipmentRows }] = await Promise.all([
      supabase
        .from("shipper_rates_public")
        .select("*")
        .eq("destination_country", destinationCode),
      supabase
        .from("shipment_requests")
        .select(
          "shipper_id, shipper_company_name, shipper_contact_name, shipper_contact_email, shipper_contact_phone, agreed_rate, currency",
        )
        .eq("buyer_id", user.id),
    ]);

    shippingRates = (rateRows ?? [])
      .filter((r) => r.rate_id != null && r.shipper_id != null)
      .map((r) => ({
        rate_id: r.rate_id as string,
        shipper_id: r.shipper_id as string,
        company_name: r.company_name ?? "Shipper",
        origin_region: r.origin_region ?? "",
        origin_port: r.origin_port,
        destination_country: r.destination_country ?? destinationCode,
        vehicle_size_type: r.vehicle_size_type,
        price: Number(r.price ?? 0),
        currency: r.currency ?? "USD",
        payment_status: r.payment_status ?? "good_standing",
      }))
      .sort(compareRatesForBuyer);
    selectedShippers = (shipmentRows ?? []) as SelectedShipper[];
  }

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
      .not("seller_details_revealed_at", "is", null)
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

  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("url, is_primary, sort_order")
    .eq("vehicle_id", id)
    .order("sort_order", { ascending: true });

  // Primary photo leads the gallery; the rest keep their sort order.
  const gallery = (photos ?? [])
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  const title = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;

  return (
    <div className="min-h-screen bg-paper">
      <BrowseHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/browse"
          className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
        >
          &larr; Back to browse
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          <VerifiedBadge />
        </div>
        <PriceBreakdown
          price={Number(v.price_usd)}
          feeResponsibility={v.fee_responsibility}
          variant="detail"
          className="mt-3 max-w-xs"
        />
        <p className="mt-2 font-mono text-sm text-ink-400">
          {v.mileage.toLocaleString("en-US")} mi · {v.location_city}, {v.location_state}
        </p>
        <div className="mt-2">
          <RatingSummary aggregate={sellerAggregate} />
          <span className="ml-1 font-mono text-xs text-ink-400">seller rating</span>
        </div>

        {gallery.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gallery.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt={`${title} photo ${i + 1}`}
                className={cn(
                  "w-full rounded-lg border border-paper-200 object-cover",
                  i === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/3]"
                )}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-paper-200 bg-paper-100 p-12 text-center font-mono text-xs uppercase tracking-wider text-ink-400">
            No photos provided
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Spec label="VIN">
            <span className="font-mono">{v.vin}</span>
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
            <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-500">
              {v.description}
            </p>
          </section>
        ) : null}

        <ReserveVehicle
          vehicleId={id}
          state={reserveState}
          requestStatus={requestStatus}
          buyerFeeUsd={feeBreakdown(Number(v.price_usd), v.fee_responsibility).buyerFee}
        />

        {user && isBuyer ? (
          <MessageSeller
            vehicleId={id}
            buyerId={user.id}
            existingConversationId={existingConversationId}
          />
        ) : null}

        {user && isBuyer ? (
          <ShippingRates
            vehicleId={id}
            destinationLabel={countryName(destinationCode)}
            rates={shippingRates}
            selected={selectedShippers}
          />
        ) : null}

        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
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
