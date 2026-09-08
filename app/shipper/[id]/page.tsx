import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { countryName } from "@/lib/shipping";
import { toAggregate } from "@/lib/reviews";

export default async function ShipperProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS "shippers approved public read" already limits this to approved,
  // non-suspended shippers.
  const { data: shipper } = await supabase
    .from("shippers")
    .select("id, company_name, service_countries, created_at, status")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!shipper) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: ratingRow }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("shipper_ratings")
      .select("avg_rating, review_count")
      .eq("shipper_id", id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, review_type, rating, comment, created_at")
      .eq("reviewee_shipper_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const aggregate = toAggregate(ratingRow);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/browse"
        className="font-mono text-xs uppercase tracking-wider text-ink-400 hover:text-ink-900"
      >
        &larr; Browse vehicles
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">
            {shipper.company_name}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink-400">
            Ships to{" "}
            {(shipper.service_countries ?? [])
              .map((c) => countryName(c))
              .join(", ") || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <RatingSummary aggregate={aggregate} size="md" />
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
          Buyer reviews
        </h2>
        <div className="mt-3">
          <ReviewList
            reviews={(reviewRows ?? []) as PublicReview[]}
            canReport={Boolean(user)}
            emptyLabel="No reviews yet. Buyers can review this shipper once a shipment is completed."
          />
        </div>
      </section>

      {!user ? (
        <p className="mt-8 text-sm text-slate-500">
          <Link href="/login" className={buttonClasses({ size: "sm", variant: "secondary" })}>
            Sign in
          </Link>{" "}
          to arrange shipping or report a review.
        </p>
      ) : null}
    </main>
  );
}

export const dynamic = "force-dynamic";
