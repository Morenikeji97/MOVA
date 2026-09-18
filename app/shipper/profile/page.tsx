import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { toAggregate } from "@/lib/reviews";
import { ShipperProfileForm } from "./profile-form";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/shipper"
        className="font-mono text-xs uppercase tracking-wider text-gray-500 hover:text-black"
      >
        &larr; Shipper portal
      </Link>
      {children}
    </main>
  );
}

export default async function ShipperProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shipper/profile");

  const { data: shipper } = await supabase
    .from("shippers")
    .select("id, company_name, description, service_countries, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!shipper || shipper.status !== "approved") {
    redirect("/shipper");
  }

  const [{ data: ratingRow }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("shipper_ratings")
      .select("avg_rating, review_count")
      .eq("shipper_id", shipper.id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, review_type, rating, comment, created_at")
      .eq("reviewee_shipper_id", shipper.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const aggregate = toAggregate(ratingRow);

  return (
    <Shell>
      <h1 className="mt-4 text-2xl font-semibold text-black">Your profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Company name, description and service countries are shown on your
        public listing page.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <ShipperProfileForm
          companyName={shipper.company_name}
          description={shipper.description ?? ""}
          serviceCountries={shipper.service_countries ?? []}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Your rating
        </h2>
        <div className="mt-3">
          <RatingSummary aggregate={aggregate} size="md" />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Published reviews
        </h2>
        <div className="mt-3">
          <ReviewList
            reviews={(reviewRows ?? []) as PublicReview[]}
            canReport={false}
            emptyLabel="No published reviews yet."
          />
        </div>
      </section>
    </Shell>
  );
}

export const dynamic = "force-dynamic";
