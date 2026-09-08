import { createClient } from "@/lib/supabase/server";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { ReviewForm } from "@/components/ui/review-form";
import { toAggregate } from "@/lib/reviews";

/**
 * Buyer-side reviews panel for /buyer/dashboard: the buyer's own reputation
 * (from sellers), plus the reviews they're eligible to leave — one per
 * fee-paid reservation and per completed shipment they haven't reviewed yet.
 */
export async function BuyerReviewHub({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [
    { data: ratingRow },
    { data: aboutMe },
    { data: paidReservations },
    { data: doneShipments },
    { data: myReviews },
  ] = await Promise.all([
    supabase
      .from("buyer_ratings")
      .select("avg_rating, review_count")
      .eq("buyer_id", userId)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, review_type, rating, comment, created_at")
      .eq("reviewee_id", userId)
      .eq("review_type", "seller_to_buyer")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("purchase_requests")
      .select("id, vehicle_id")
      .eq("buyer_id", userId)
      .eq("mova_fee_payment_status", "paid")
      .not("seller_details_revealed_at", "is", null),
    supabase
      .from("shipment_requests")
      .select("id, shipper_id, shipper_company_name")
      .eq("buyer_id", userId)
      .eq("status", "completed"),
    supabase
      .from("reviews")
      .select("purchase_request_id, shipment_request_id, review_type")
      .eq("reviewer_id", userId),
  ]);

  const reviewedPrIds = new Set(
    (myReviews ?? [])
      .filter((r) => r.review_type === "buyer_to_seller")
      .map((r) => r.purchase_request_id),
  );
  const reviewedSrIds = new Set(
    (myReviews ?? [])
      .filter((r) => r.review_type === "buyer_to_shipper")
      .map((r) => r.shipment_request_id),
  );

  const openPr = (paidReservations ?? []).filter((p) => !reviewedPrIds.has(p.id));
  const openSr = (doneShipments ?? []).filter((s) => !reviewedSrIds.has(s.id));

  const vehicleIds = [...new Set(openPr.map((p) => p.vehicle_id))];
  const { data: vehicleRows } = vehicleIds.length
    ? await supabase
        .from("vehicles")
        .select("id, seller_id, year, make, model, trim")
        .in("id", vehicleIds)
    : { data: [] };
  const vehicleById = new Map((vehicleRows ?? []).map((v) => [v.id, v]));

  const aggregate = toAggregate(ratingRow);
  const nothingToLeave = openPr.length === 0 && openSr.length === 0;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink-900">Reviews</h2>

      <div className="mt-3 rounded-lg border border-paper-200 bg-paper-100 p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Your buyer rating
        </p>
        <div className="mt-1">
          <RatingSummary aggregate={aggregate} size="md" />
        </div>
        {(aboutMe ?? []).length > 0 ? (
          <div className="mt-4">
            <ReviewList reviews={(aboutMe ?? []) as PublicReview[]} />
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Reviews you can leave
        </p>
        {nothingToLeave ? (
          <p className="mt-2 text-sm text-slate-500">
            Nothing to review yet — you can review a seller once you&rsquo;ve paid
            MOVA&rsquo;s fee, and a shipper once your shipment is completed.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {openPr.map((p) => {
              const v = vehicleById.get(p.vehicle_id);
              if (!v) return null;
              const label = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
              return (
                <ReviewForm
                  key={p.id}
                  target={{
                    reviewType: "buyer_to_seller",
                    revieweeId: v.seller_id,
                    purchaseRequestId: p.id,
                  }}
                  counterpartyLabel={`the seller of the ${label}`}
                />
              );
            })}
            {openSr.map((s) => (
              <ReviewForm
                key={s.id}
                target={{
                  reviewType: "buyer_to_shipper",
                  revieweeShipperId: s.shipper_id,
                  shipmentRequestId: s.id,
                }}
                counterpartyLabel={s.shipper_company_name ?? "the shipper"}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
