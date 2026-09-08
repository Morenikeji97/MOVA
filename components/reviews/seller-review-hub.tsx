import { createClient } from "@/lib/supabase/server";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { ReviewForm } from "@/components/ui/review-form";
import { toAggregate } from "@/lib/reviews";

/**
 * Seller-side reviews panel for /seller/dashboard: the seller's own reputation
 * (from buyers), plus a review form per fee-paid reservation whose buyer they
 * haven't reviewed yet.
 */
export async function SellerReviewHub({ userId }: { userId: string }) {
  const supabase = await createClient();

  // The seller's own vehicles, then fee-paid reservations against them.
  const { data: myVehicles } = await supabase
    .from("vehicles")
    .select("id, year, make, model, trim")
    .eq("seller_id", userId);
  const vehicleById = new Map((myVehicles ?? []).map((v) => [v.id, v]));
  const vehicleIds = [...vehicleById.keys()];

  const [{ data: ratingRow }, { data: aboutMe }, { data: paidReservations }, { data: myReviews }] =
    await Promise.all([
      supabase
        .from("seller_ratings")
        .select("avg_rating, review_count")
        .eq("seller_id", userId)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select("id, review_type, rating, comment, created_at")
        .eq("reviewee_id", userId)
        .eq("review_type", "buyer_to_seller")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30),
      vehicleIds.length
        ? supabase
            .from("purchase_requests")
            .select("id, vehicle_id, buyer_id")
            .in("vehicle_id", vehicleIds)
            .eq("mova_fee_payment_status", "paid")
            .not("seller_details_revealed_at", "is", null)
        : Promise.resolve({ data: [] as { id: string; vehicle_id: string; buyer_id: string }[] }),
      supabase
        .from("reviews")
        .select("purchase_request_id, review_type")
        .eq("reviewer_id", userId)
        .eq("review_type", "seller_to_buyer"),
    ]);

  const reviewedPrIds = new Set(
    (myReviews ?? []).map((r) => r.purchase_request_id),
  );
  const openPr = (paidReservations ?? []).filter((p) => !reviewedPrIds.has(p.id));

  const aggregate = toAggregate(ratingRow);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink-900">Reviews</h2>

      <div className="mt-3 rounded-lg border border-paper-200 bg-paper-100 p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Your seller rating
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
        {openPr.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Nothing to review yet — you can review a buyer once they&rsquo;ve
            paid MOVA&rsquo;s fee on one of your vehicles.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {openPr.map((p) => {
              const v = vehicleById.get(p.vehicle_id);
              const label = v
                ? `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`
                : "your vehicle";
              return (
                <ReviewForm
                  key={p.id}
                  target={{
                    reviewType: "seller_to_buyer",
                    revieweeId: p.buyer_id,
                    purchaseRequestId: p.id,
                  }}
                  counterpartyLabel={`the buyer of the ${label}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
