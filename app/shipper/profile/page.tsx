import { type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink, DashboardHeader, DashboardShell } from "@/components/ui/dashboard";
import { cardClasses } from "@/components/ui/card";
import { RatingSummary } from "@/components/ui/rating-summary";
import { ReviewList, type PublicReview } from "@/components/ui/review-list";
import { toAggregate } from "@/lib/reviews";
import { ShipperProfileForm } from "./profile-form";

function Shell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell narrow>
      <BackLink href="/shipper/portal">Shipper portal</BackLink>
      {children}
    </DashboardShell>
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
    .select("id, company_name, description, service_countries, service_areas, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!shipper || shipper.status !== "approved") {
    redirect("/shipper/portal");
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
      <DashboardHeader
        className="mt-2"
        title="Your profile"
        intro="Company name, description and service countries are shown on your public listing page."
      />

      <div className={cardClasses({ className: "mt-6" })}>
        <ShipperProfileForm
          companyName={shipper.company_name}
          description={shipper.description ?? ""}
          serviceCountries={shipper.service_countries ?? []}
          serviceAreas={shipper.service_areas ?? []}
        />
      </div>

      <section className={cardClasses({ className: "mt-4" })}>
        <h2 className="font-display text-lg font-bold text-ink">Your rating</h2>
        <div className="mt-3">
          <RatingSummary aggregate={aggregate} size="md" />
        </div>
      </section>

      <section className={cardClasses({ className: "mt-4" })}>
        <h2 className="font-display text-lg font-bold text-ink">Published reviews</h2>
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
