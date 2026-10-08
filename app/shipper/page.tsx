import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BadgeDollarSign, FileCheck, MapPin, Receipt, Rocket } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { PageHero, heroButtonClasses } from "@/components/ui/page-hero";
import { BenefitsSection, type Benefit } from "@/components/ui/benefits-section";
import { whatsappLink } from "@/lib/whatsapp";
import { SHIPPER_NO_FEES_HEADLINE } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Ship with ShipMova",
  description: "Verified cars, paid-up buyers and clean paperwork, ready to move.",
};

const SHIPPER_BENEFITS: Benefit[] = [
  {
    icon: BadgeDollarSign,
    title: SHIPPER_NO_FEES_HEADLINE,
    body: "ShipMova charges you nothing: no commission and no card on file. ShipMova takes no cut of your shipping price.",
  },
  {
    icon: Rocket,
    title: "Jobs that are ready to go",
    body: "The buyer has already paid into escrow and the car is verified before you're booked.",
  },
  {
    icon: FileCheck,
    title: "Clean title handoff",
    body: "The title is checked against the seller's verified ID before pickup, and you collect the original at pickup.",
  },
  {
    icon: MapPin,
    title: "Local jobs first",
    body: "Tell us the states you serve and we rank you first for nearby pickups.",
  },
  {
    icon: BadgeCheck,
    title: "A verified-only network",
    body: "We check every shipper's FMC license, bond and cargo insurance, and show buyers an \"Insured\" badge. Serious operators only.",
  },
  {
    icon: Receipt,
    title: "Buyers who know the costs",
    body: "Buyers see shipping estimates upfront, so quotes aren't a surprise.",
  },
];

/**
 * Public shipper landing page. The signed-in shipper portal (rates, profile)
 * lives at /shipper/portal; "Shipper sign in" goes there, and it
 * sends signed-out visitors to login first.
 */
export default function ShipperLandingPage() {
  const wa = whatsappLink();
  return (
    <main className="min-h-screen bg-white">
      <PageHero
        eyebrow="For shippers"
        title="Ship with ShipMova"
        intro="Verified cars, paid-up buyers and clean paperwork, ready to move."
      >
        <Link href="/shipper/signup" className={heroButtonClasses("solid")}>
          Apply to ship with us <ArrowRightIcon size={18} />
        </Link>
        <Link href="/shipper/portal" className={heroButtonClasses("outline")}>
          Shipper sign in
        </Link>
      </PageHero>

      <BenefitsSection
        benefits={SHIPPER_BENEFITS}
      >
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/shipper/signup" className={buttonClasses({ className: "w-full sm:w-auto" })}>
            Apply to ship with us <ArrowRightIcon size={18} />
          </Link>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">
              Questions? WhatsApp us
            </a>
          ) : null}
        </div>
      </BenefitsSection>
    </main>
  );
}
